"use server";

import { between, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/transactions";
import { db } from "@/db";
import {
  categories,
  categoryRules,
  importBatches,
  paymentMethods,
  transactions,
} from "@/db/schema";
import { applyRules, type CategoryRule } from "@/lib/import/categorize";
import { fingerprintStatement } from "@/lib/import/fingerprint";
import { normalizeMerchant } from "@/lib/import/normalize";
import { parseXlsxGrid } from "@/lib/import/parsers/xlsx";
import { guessPaymentMethodName } from "@/lib/import/payment-method";
import { mapStatementRows, type ParsedRow } from "@/lib/import/statement";
import { getCurrentUser } from "@/lib/current-user";
import { commitImportSchema, type CommitImportValues } from "@/lib/validations/import";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type DuplicateKind = "exact" | "similar";

export type PreviewRow = {
  fingerprint: string;
  rowNumber: number;
  occurredOn: string;
  time: string | null;
  kind: "expense" | "income";
  amount: string;
  /** Как написано в выписке. */
  merchant: string;
  /** Ключ, по которому сработали правила и по которому создаётся новое правило. */
  merchantKey: string;
  description: string;
  note: string;
  pending: boolean;
  categoryId: string | null;
  paymentMethodId: string | null;
  /** Задан, только если правило явно навязало «общее» или «личное». */
  scope: "shared" | "personal" | null;
  duplicate: DuplicateKind | null;
};

export type ImportPreview = {
  originalFilename: string;
  rows: PreviewRow[];
  warnings: string[];
};

function revalidateImportPages() {
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/goals");
  revalidatePath("/settings");
}

function buildNote(row: ParsedRow): string {
  const note = row.merchant.trim() || row.description.trim();
  return note.slice(0, 500);
}

async function loadActiveRules(): Promise<CategoryRule[]> {
  // Правила архивных категорий не применяем — иначе импорт воскресит их.
  return db
    .select({
      id: categoryRules.id,
      matchType: categoryRules.matchType,
      pattern: categoryRules.pattern,
      categoryId: categoryRules.categoryId,
      scope: categoryRules.scope,
      priority: categoryRules.priority,
    })
    .from(categoryRules)
    .innerJoin(categories, eq(categories.id, categoryRules.categoryId))
    .where(isNull(categories.archivedAt));
}

/**
 * Разбирает выписку и показывает, что получится. В базу ничего не пишет —
 * решение принимает человек на экране предпросмотра.
 */
export async function previewImport(
  formData: FormData,
): Promise<ActionResult<ImportPreview>> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Файл не получен, попробуйте ещё раз." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { success: false, error: "Нужен файл .xlsx — выгрузка из интернет-банка." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: "Файл больше 5 МБ." };
  }

  let parsed;
  try {
    parsed = mapStatementRows(parseXlsxGrid(await file.arrayBuffer()));
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось разобрать файл.",
    };
  }

  const [rules, methods] = await Promise.all([loadActiveRules(), db.select().from(paymentMethods)]);
  const methodIdByName = new Map(methods.map((method) => [method.name, method.id]));

  const fingerprints = fingerprintStatement(parsed.rows);
  const dates = parsed.rows.map((row) => row.occurredOn).sort();

  const [existingByFingerprint, existingByDateAmount] = await Promise.all([
    db
      .select({ fingerprint: transactions.fingerprint })
      .from(transactions)
      .where(inArray(transactions.fingerprint, fingerprints)),
    db
      .select({ occurredOn: transactions.occurredOn, amount: transactions.amount })
      .from(transactions)
      .where(between(transactions.occurredOn, dates[0], dates[dates.length - 1])),
  ]);

  const seenFingerprints = new Set(existingByFingerprint.map((row) => row.fingerprint));
  const seenDateAmounts = new Set(
    existingByDateAmount.map((row) => `${row.occurredOn}|${row.amount}`),
  );

  const rows: PreviewRow[] = parsed.rows.map((row, index) => {
    const rule = applyRules(rules, row);
    const methodName = guessPaymentMethodName(row);
    const fingerprint = fingerprints[index];

    let duplicate: DuplicateKind | null = null;
    if (seenFingerprints.has(fingerprint)) {
      duplicate = "exact";
    } else if (seenDateAmounts.has(`${row.occurredOn}|${row.amount}`)) {
      duplicate = "similar";
    }

    return {
      fingerprint,
      rowNumber: row.rowNumber,
      occurredOn: row.occurredOn,
      time: row.time,
      kind: row.kind,
      amount: row.amount,
      merchant: row.merchant,
      merchantKey: normalizeMerchant(row.merchant),
      description: row.description,
      note: buildNote(row),
      pending: row.pending,
      categoryId: rule?.categoryId ?? null,
      paymentMethodId: (methodName && methodIdByName.get(methodName)) ?? null,
      scope: rule?.scope ?? null,
      duplicate,
    };
  });

  return {
    success: true,
    data: { originalFilename: file.name, rows, warnings: parsed.warnings },
  };
}

/** Пишет подтверждённые строки одной транзакцией БД и заводит батч для отката. */
export async function commitImport(
  input: CommitImportValues,
): Promise<ActionResult<{ importedCount: number; skippedCount: number }>> {
  const parsed = commitImportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте выбранные строки.",
    };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Не удалось определить, кто загружает выписку." };
  }

  const { originalFilename, rowCount, rows } = parsed.data;

  const importedCount = await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(importBatches)
      .values({
        source: "xlsx",
        originalFilename,
        uploadedByUserId: currentUser.id,
        rowCount,
        importedCount: 0,
        skippedCount: 0,
      })
      .returning({ id: importBatches.id });

    const inserted = await tx
      .insert(transactions)
      .values(
        rows.map((row) => ({
          occurredOn: row.occurredOn,
          kind: row.kind,
          amount: row.amount,
          categoryId: row.categoryId,
          paidByUserId: row.paidByUserId,
          scope: row.scope,
          paymentMethodId: row.paymentMethodId,
          note: row.note || null,
          importBatchId: batch.id,
          fingerprint: row.fingerprint,
          createdByUserId: currentUser.id,
        })),
      )
      // Строку, которую параллельно завёл кто-то другой, молча пропускаем.
      .onConflictDoNothing({ target: transactions.fingerprint })
      .returning({ id: transactions.id });

    await saveMerchantRules(tx, rows);

    await tx
      .update(importBatches)
      .set({
        importedCount: inserted.length,
        skippedCount: rowCount - inserted.length,
      })
      .where(eq(importBatches.id, batch.id));

    return inserted.length;
  });

  revalidateImportPages();

  return {
    success: true,
    data: { importedCount, skippedCount: rowCount - importedCount },
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Создаёт правила «этот мерчант → эта категория» для отмеченных строк. */
async function saveMerchantRules(tx: Tx, rows: CommitImportValues["rows"]) {
  const wanted = new Map<string, string>();
  for (const row of rows) {
    if (row.rememberPattern) wanted.set(row.rememberPattern.toUpperCase(), row.categoryId);
  }
  if (wanted.size === 0) return;

  const patterns = [...wanted.keys()];
  const existing = await tx
    .select({ pattern: categoryRules.pattern })
    .from(categoryRules)
    .where(inArray(categoryRules.pattern, patterns));
  const known = new Set(existing.map((rule) => rule.pattern.toUpperCase()));

  const fresh = [...wanted]
    .filter(([pattern]) => !known.has(pattern))
    .map(([pattern, categoryId]) => ({
      matchType: "contains" as const,
      pattern,
      categoryId,
      // Правило, заведённое руками, должно побеждать стартовый набор.
      priority: 10,
    }));

  if (fresh.length > 0) await tx.insert(categoryRules).values(fresh);
}

export async function rollbackImportBatch(id: string): Promise<ActionResult> {
  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(eq(transactions.importBatchId, id));
    await tx.delete(importBatches).where(eq(importBatches.id, id));
  });

  revalidateImportPages();

  return { success: true, data: undefined };
}

"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { categories, goals, settings, transactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import {
  transactionSchema,
  type TransactionFormValues,
} from "@/lib/validations/transaction";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

const SAVINGS_CATEGORY_KEY = "savings_category_id";
const SAVINGS_CATEGORY_NAME = "Накопления";
const SAVINGS_CATEGORY_COLOR = "#0ea5e9";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateTransactionPages() {
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/goals");
  revalidatePath("/settings");
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function adjustGoalSavedAmount(
  tx: Tx,
  goalId: string,
  delta: string,
) {
  return tx
    .update(goals)
    .set({ savedAmount: sql`${goals.savedAmount} + ${delta}` })
    .where(eq(goals.id, goalId));
}

// Пополнение цели не требует категории в форме, но колонка в БД обязательная:
// такие операции складываем в служебную категорию «Накопления». Ссылка на неё
// живёт в settings, чтобы переименование категории ничего не ломало.
async function resolveSavingsCategoryId(tx: Tx): Promise<string> {
  const [pointer] = await tx
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SAVINGS_CATEGORY_KEY));

  if (pointer && UUID_PATTERN.test(pointer.value)) {
    const [existing] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, pointer.value));
    if (existing) return existing.id;
  }

  const [{ maxSortOrder }] = await tx
    .select({
      maxSortOrder: sql<number>`coalesce(max(${categories.sortOrder}), -1)`.mapWith(
        Number,
      ),
    })
    .from(categories)
    .where(eq(categories.kind, "expense"));

  const [created] = await tx
    .insert(categories)
    .values({
      name: SAVINGS_CATEGORY_NAME,
      kind: "expense",
      color: SAVINGS_CATEGORY_COLOR,
      sortOrder: maxSortOrder + 1,
    })
    .returning({ id: categories.id });

  await tx
    .insert(settings)
    .values({ key: SAVINGS_CATEGORY_KEY, value: created.id })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: created.id },
    });

  return created.id;
}

export async function createTransaction(
  input: TransactionFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля формы.",
    };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Не удалось определить, кто добавляет трату." };
  }

  const row = await db.transaction(async (tx) => {
    const categoryId =
      parsed.data.categoryId ?? (await resolveSavingsCategoryId(tx));

    const [inserted] = await tx
      .insert(transactions)
      .values({
        kind: parsed.data.kind,
        amount: parsed.data.amount.toFixed(2),
        occurredOn: parsed.data.occurredOn,
        categoryId,
        scope: parsed.data.scope,
        paidByUserId: parsed.data.paidByUserId,
        paymentMethodId: parsed.data.paymentMethodId,
        goalId: parsed.data.goalId,
        note: parsed.data.note || null,
        createdByUserId: currentUser.id,
      })
      .returning({ id: transactions.id });

    if (parsed.data.goalId) {
      await adjustGoalSavedAmount(tx, parsed.data.goalId, parsed.data.amount.toFixed(2));
    }

    return inserted;
  });

  revalidateTransactionPages();

  return { success: true, data: { id: row.id } };
}

export async function updateTransaction(
  id: string,
  input: TransactionFormValues,
): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля формы.",
    };
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ goalId: transactions.goalId, amount: transactions.amount })
      .from(transactions)
      .where(eq(transactions.id, id));

    if (existing?.goalId) {
      await adjustGoalSavedAmount(tx, existing.goalId, `-${existing.amount}`);
    }

    const categoryId =
      parsed.data.categoryId ?? (await resolveSavingsCategoryId(tx));

    await tx
      .update(transactions)
      .set({
        kind: parsed.data.kind,
        amount: parsed.data.amount.toFixed(2),
        occurredOn: parsed.data.occurredOn,
        categoryId,
        scope: parsed.data.scope,
        paidByUserId: parsed.data.paidByUserId,
        paymentMethodId: parsed.data.paymentMethodId,
        goalId: parsed.data.goalId,
        note: parsed.data.note || null,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id));

    if (parsed.data.goalId) {
      await adjustGoalSavedAmount(tx, parsed.data.goalId, parsed.data.amount.toFixed(2));
    }
  });

  revalidateTransactionPages();

  return { success: true, data: undefined };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ goalId: transactions.goalId, amount: transactions.amount })
      .from(transactions)
      .where(eq(transactions.id, id));

    if (existing?.goalId) {
      await adjustGoalSavedAmount(tx, existing.goalId, `-${existing.amount}`);
    }

    await tx.delete(transactions).where(eq(transactions.id, id));
  });

  revalidateTransactionPages();

  return { success: true, data: undefined };
}

"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { goals, transactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import {
  transactionSchema,
  type TransactionFormValues,
} from "@/lib/validations/transaction";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

function revalidateTransactionPages() {
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/goals");
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
    const [inserted] = await tx
      .insert(transactions)
      .values({
        kind: parsed.data.kind,
        amount: parsed.data.amount.toFixed(2),
        occurredOn: parsed.data.occurredOn,
        categoryId: parsed.data.categoryId,
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

    await tx
      .update(transactions)
      .set({
        kind: parsed.data.kind,
        amount: parsed.data.amount.toFixed(2),
        occurredOn: parsed.data.occurredOn,
        categoryId: parsed.data.categoryId,
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

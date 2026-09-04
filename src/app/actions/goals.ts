"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { goals } from "@/db/schema";
import { goalSchema, type GoalFormValues } from "@/lib/validations/goal";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createGoal(
  input: GoalFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля формы.",
    };
  }

  const [row] = await db
    .insert(goals)
    .values({
      title: parsed.data.title,
      targetAmount: parsed.data.targetAmount.toFixed(2),
      savedAmount: parsed.data.savedAmount.toFixed(2),
      deadline: parsed.data.deadline,
    })
    .returning({ id: goals.id });

  revalidatePath("/goals");

  return { success: true, data: { id: row.id } };
}

export async function updateGoal(
  id: string,
  input: GoalFormValues,
): Promise<ActionResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля формы.",
    };
  }

  await db
    .update(goals)
    .set({
      title: parsed.data.title,
      targetAmount: parsed.data.targetAmount.toFixed(2),
      savedAmount: parsed.data.savedAmount.toFixed(2),
      deadline: parsed.data.deadline,
    })
    .where(eq(goals.id, id));

  revalidatePath("/goals");

  return { success: true, data: undefined };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  await db.delete(goals).where(eq(goals.id, id));
  revalidatePath("/goals");
  return { success: true, data: undefined };
}

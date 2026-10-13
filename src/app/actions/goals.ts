"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { goals } from "@/db/schema";
import { goalSchema, type GoalFormValues } from "@/lib/validations/goal";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

// Цели видны и на /goals, и в ленте на дашборде.
function revalidateGoalPages() {
  revalidatePath("/goals");
  revalidatePath("/");
}

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

  // Новая цель встаёт в конец очереди приоритетов.
  const row = await db.transaction(async (tx) => {
    const [{ maxPriority }] = await tx
      .select({
        maxPriority: sql<number>`coalesce(max(${goals.priority}), -1)`.mapWith(Number),
      })
      .from(goals);

    const [inserted] = await tx
      .insert(goals)
      .values({
        title: parsed.data.title,
        targetAmount: parsed.data.targetAmount.toFixed(2),
        savedAmount: parsed.data.savedAmount.toFixed(2),
        deadline: parsed.data.deadline,
        priority: maxPriority + 1,
      })
      .returning({ id: goals.id });

    return inserted;
  });

  revalidateGoalPages();

  return { success: true, data: { id: row.id } };
}

// Порядок целей — это приоритет: чем выше цель, тем раньше она получает деньги
// из зарплаты.
export async function reorderGoals(orderedIds: string[]): Promise<ActionResult> {
  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.update(goals).set({ priority: index }).where(eq(goals.id, id));
    }
  });

  revalidateGoalPages();

  return { success: true, data: undefined };
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

  revalidateGoalPages();

  return { success: true, data: undefined };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  await db.delete(goals).where(eq(goals.id, id));
  revalidateGoalPages();
  return { success: true, data: undefined };
}

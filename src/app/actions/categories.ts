"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { categories, categoryLimits, paySchedules } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import {
  categoryLimitSchema,
  categorySchema,
  createCategorySchema,
  type CategoryFormValues,
  type CategoryLimitFormInput,
  type CreateCategoryFormValues,
} from "@/lib/validations/category";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

function revalidateCategoryPages() {
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/history");
}

export async function createCategory(
  input: CreateCategoryFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля формы.",
    };
  }

  const currentUser = await getCurrentUser();

  const row = await db.transaction(async (tx) => {
    const [{ maxSortOrder }] = await tx
      .select({ maxSortOrder: sql<number>`coalesce(max(${categories.sortOrder}), -1)`.mapWith(Number) })
      .from(categories)
      .where(eq(categories.kind, parsed.data.kind));

    const [inserted] = await tx
      .insert(categories)
      .values({
        name: parsed.data.name,
        color: parsed.data.color,
        kind: parsed.data.kind,
        sortOrder: maxSortOrder + 1,
      })
      .returning({ id: categories.id });

    if (parsed.data.monthlyLimit !== null && currentUser) {
      await tx.insert(categoryLimits).values({
        categoryId: inserted.id,
        userId: currentUser.id,
        monthlyLimit: parsed.data.monthlyLimit.toFixed(2),
      });
    }

    return inserted;
  });

  revalidateCategoryPages();

  return { success: true, data: { id: row.id } };
}

export async function updateCategory(
  id: string,
  input: CategoryFormValues,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля формы.",
    };
  }

  await db
    .update(categories)
    .set({
      name: parsed.data.name,
      color: parsed.data.color,
    })
    .where(eq(categories.id, id));

  revalidateCategoryPages();

  return { success: true, data: undefined };
}

// Лимит всегда пишется в строку текущего пользователя — какой именно человек
// правит лимит, решает активная сессия (шапка), а не аргумент с клиента.
export async function setCategoryLimit(
  categoryId: string,
  input: CategoryLimitFormInput,
): Promise<ActionResult> {
  const parsed = categoryLimitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте лимит.",
    };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Не удалось определить пользователя." };
  }

  await db.transaction(async (tx) => {
    const condition = and(
      eq(categoryLimits.categoryId, categoryId),
      eq(categoryLimits.userId, currentUser.id),
    );

    if (parsed.data.monthlyLimit === null) {
      await tx.delete(categoryLimits).where(condition);
      return;
    }

    const [existing] = await tx
      .select({ id: categoryLimits.id })
      .from(categoryLimits)
      .where(condition);

    if (existing) {
      await tx
        .update(categoryLimits)
        .set({ monthlyLimit: parsed.data.monthlyLimit.toFixed(2) })
        .where(eq(categoryLimits.id, existing.id));
    } else {
      await tx.insert(categoryLimits).values({
        categoryId,
        userId: currentUser.id,
        monthlyLimit: parsed.data.monthlyLimit.toFixed(2),
      });
    }
  });

  revalidateCategoryPages();

  return { success: true, data: undefined };
}

// Закрепляет категорию за выплатой текущего пользователя (аренда — «из аванса»);
// null — лимит снова делится поровну. Работает только для категории, у которой
// уже есть лимит этого человека, и только с его собственной выплатой.
export async function setCategoryPaySlot(
  categoryId: string,
  payScheduleId: string | null,
): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Не удалось определить пользователя." };
  }

  if (payScheduleId) {
    const [slot] = await db
      .select({ id: paySchedules.id })
      .from(paySchedules)
      .where(and(eq(paySchedules.id, payScheduleId), eq(paySchedules.userId, currentUser.id)));
    if (!slot) {
      return { success: false, error: "Такой выплаты нет. Обновите страницу." };
    }
  }

  const updated = await db
    .update(categoryLimits)
    .set({ payScheduleId })
    .where(
      and(
        eq(categoryLimits.categoryId, categoryId),
        eq(categoryLimits.userId, currentUser.id),
      ),
    )
    .returning({ id: categoryLimits.id });

  if (updated.length === 0) {
    return { success: false, error: "Сначала задайте лимит для этой категории." };
  }

  revalidateCategoryPages();

  return { success: true, data: undefined };
}

export async function setCategoryArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  await db
    .update(categories)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(categories.id, id));

  revalidateCategoryPages();

  return { success: true, data: undefined };
}

export async function reorderCategories(orderedIds: string[]): Promise<ActionResult> {
  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.update(categories).set({ sortOrder: index }).where(eq(categories.id, id));
    }
  });

  revalidateCategoryPages();

  return { success: true, data: undefined };
}

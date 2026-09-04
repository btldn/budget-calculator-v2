"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { categories } from "@/db/schema";
import {
  categorySchema,
  createCategorySchema,
  type CategoryFormValues,
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

  const [{ maxSortOrder }] = await db
    .select({ maxSortOrder: sql<number>`coalesce(max(${categories.sortOrder}), -1)`.mapWith(Number) })
    .from(categories)
    .where(eq(categories.kind, parsed.data.kind));

  const [row] = await db
    .insert(categories)
    .values({
      name: parsed.data.name,
      color: parsed.data.color,
      kind: parsed.data.kind,
      monthlyLimit: parsed.data.monthlyLimit?.toFixed(2) ?? null,
      sortOrder: maxSortOrder + 1,
    })
    .returning({ id: categories.id });

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
      monthlyLimit: parsed.data.monthlyLimit?.toFixed(2) ?? null,
    })
    .where(eq(categories.id, id));

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

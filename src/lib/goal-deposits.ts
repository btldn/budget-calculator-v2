import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, goals, settings } from "@/db/schema";

const SAVINGS_CATEGORY_KEY = "savings_category_id";
const SAVINGS_CATEGORY_NAME = "Накопления";
const SAVINGS_CATEGORY_COLOR = "#0ea5e9";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function adjustGoalSavedAmount(tx: Tx, goalId: string, delta: string) {
  return tx
    .update(goals)
    .set({ savedAmount: sql`${goals.savedAmount} + ${delta}` })
    .where(eq(goals.id, goalId));
}

// Пополнение цели не требует категории в форме, но колонка в БД обязательная:
// такие операции складываем в служебную категорию «Накопления». Ссылка на неё
// живёт в settings, чтобы переименование категории ничего не ломало.
export async function resolveSavingsCategoryId(tx: Tx): Promise<string> {
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

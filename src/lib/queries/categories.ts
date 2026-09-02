import "server-only";

import { asc, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, paymentMethods, transactions } from "@/db/schema";

export type CategoryOption = {
  id: string;
  name: string;
  kind: "expense" | "income";
  color: string;
  sortOrder: number;
  usageCount: number;
};

async function getUsageCounts() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .where(gte(transactions.createdAt, since))
    .groupBy(transactions.categoryId);

  return new Map(rows.map((row) => [row.categoryId, row.count]));
}

export async function getCategoriesByKind(): Promise<{
  expense: CategoryOption[];
  income: CategoryOption[];
}> {
  const [rows, usage] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(isNull(categories.archivedAt))
      .orderBy(asc(categories.sortOrder)),
    getUsageCounts(),
  ]);

  const withUsage = rows.map((category) => ({
    id: category.id,
    name: category.name,
    kind: category.kind,
    color: category.color,
    sortOrder: category.sortOrder,
    usageCount: usage.get(category.id) ?? 0,
  }));

  const byUsage = (a: CategoryOption, b: CategoryOption) =>
    b.usageCount - a.usageCount || a.sortOrder - b.sortOrder;

  return {
    expense: withUsage.filter((c) => c.kind === "expense").sort(byUsage),
    income: withUsage.filter((c) => c.kind === "income").sort(byUsage),
  };
}

export async function getAllCategories() {
  return db
    .select()
    .from(categories)
    .where(isNull(categories.archivedAt))
    .orderBy(asc(categories.sortOrder));
}

export async function getAllPaymentMethods() {
  return db
    .select()
    .from(paymentMethods)
    .where(isNull(paymentMethods.archivedAt))
    .orderBy(asc(paymentMethods.name));
}

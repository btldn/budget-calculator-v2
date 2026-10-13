import "server-only";

import { asc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, categoryLimits, paymentMethods, transactions } from "@/db/schema";
import { limitedFirst } from "@/lib/category-order";

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

export type SettingsCategory = {
  id: string;
  name: string;
  color: string;
  kind: "expense" | "income";
  archivedAt: Date | null;
  // Лимит именно currentUserId — у каждого человека своя цифра.
  monthlyLimit: string | null;
  // Выплата, из которой категория оплачивается целиком; null — поровну.
  payScheduleId: string | null;
};

export async function getCategoriesForSettings(currentUserId: string): Promise<{
  expense: { active: SettingsCategory[]; archived: SettingsCategory[] };
  income: { active: SettingsCategory[]; archived: SettingsCategory[] };
}> {
  const [rows, limitRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db
      .select({
        categoryId: categoryLimits.categoryId,
        monthlyLimit: categoryLimits.monthlyLimit,
        payScheduleId: categoryLimits.payScheduleId,
      })
      .from(categoryLimits)
      .where(eq(categoryLimits.userId, currentUserId)),
  ]);

  const limitMap = new Map(limitRows.map((row) => [row.categoryId, row]));

  const withLimits: SettingsCategory[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    kind: c.kind,
    archivedAt: c.archivedAt,
    monthlyLimit: limitMap.get(c.id)?.monthlyLimit ?? null,
    payScheduleId: limitMap.get(c.id)?.payScheduleId ?? null,
  }));

  const split = (kind: "expense" | "income") => ({
    active: withLimits
      .filter((c) => c.kind === kind && !c.archivedAt)
      .sort(limitedFirst),
    archived: withLimits.filter((c) => c.kind === kind && c.archivedAt),
  });

  return { expense: split("expense"), income: split("income") };
}

export async function getPaymentMethodsForSettings() {
  const rows = await db.select().from(paymentMethods).orderBy(asc(paymentMethods.name));

  return {
    active: rows.filter((m) => !m.archivedAt),
    archived: rows.filter((m) => m.archivedAt),
  };
}

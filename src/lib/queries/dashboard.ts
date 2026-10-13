import "server-only";

import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, categoryLimits, transactions } from "@/db/schema";

export function getMonthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const endDate = new Date(year, m, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export function getPreviousMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Условия «операция попадает в месяц и, если задан фильтр, оплачена этим
// человеком». Возвращает массив, чтобы разворачивать его в and(...) рядом с
// условиями конкретного запроса; undefined внутри and() игнорируется.
function monthConditions(month: string, paidByUserId?: string | null) {
  const { start, end } = getMonthRange(month);
  return [
    gte(transactions.occurredOn, start),
    lt(transactions.occurredOn, end),
    paidByUserId ? eq(transactions.paidByUserId, paidByUserId) : undefined,
  ];
}

export async function getMonthExpenseIncome(
  month: string,
  paidByUserId?: string | null,
) {
  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'income'), 0)`,
      expense: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'expense'), 0)`,
      transactionCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .where(and(...monthConditions(month, paidByUserId)));

  return row;
}

export type CategoryProgress = {
  id: string;
  name: string;
  color: string;
  monthlyLimit: string | null;
  spent: string;
  percent: number | null;
};

// Без фильтра лимит категории — это её общий лимит семьи ("общий") плюс все
// персональные лимиты (так существующие данные, ставшие "общими" строками,
// продолжают работать как раньше). С фильтром по человеку — только его
// персональная строка; нет строки — лимита нет, к общему не откатываемся.
function categoryLimitRows(paidByUserId?: string | null) {
  return paidByUserId
    ? db
        .select({ categoryId: categoryLimits.categoryId, total: categoryLimits.monthlyLimit })
        .from(categoryLimits)
        .where(eq(categoryLimits.userId, paidByUserId))
    : db
        .select({
          categoryId: categoryLimits.categoryId,
          total: sql<string>`sum(${categoryLimits.monthlyLimit})`,
        })
        .from(categoryLimits)
        .groupBy(categoryLimits.categoryId);
}

export async function getCategoryProgress(
  month: string,
  paidByUserId?: string | null,
): Promise<CategoryProgress[]> {
  const [cats, spentRows, limitRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(and(eq(categories.kind, "expense"), isNull(categories.archivedAt)))
      .orderBy(asc(categories.sortOrder)),
    db
      .select({
        categoryId: transactions.categoryId,
        total: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.kind, "expense"),
          ...monthConditions(month, paidByUserId),
        ),
      )
      .groupBy(transactions.categoryId),
    categoryLimitRows(paidByUserId),
  ]);

  const spentMap = new Map(spentRows.map((row) => [row.categoryId, row.total]));
  const limitMap = new Map(limitRows.map((row) => [row.categoryId, row.total]));

  const rows: CategoryProgress[] = cats.map((category) => {
    const spent = spentMap.get(category.id) ?? "0";
    const monthlyLimit = limitMap.get(category.id) ?? null;
    const percent = monthlyLimit
      ? (Number(spent) / Number(monthlyLimit)) * 100
      : null;
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      monthlyLimit,
      spent,
      percent,
    };
  });

  return rows.sort((a, b) => {
    if (a.percent === null && b.percent === null) return Number(b.spent) - Number(a.spent);
    if (a.percent === null) return 1;
    if (b.percent === null) return -1;
    return b.percent - a.percent;
  });
}

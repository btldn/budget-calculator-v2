import "server-only";

import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, transactions } from "@/db/schema";

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

export async function getMonthExpenseIncome(month: string) {
  const { start, end } = getMonthRange(month);
  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'income'), 0)`,
      expense: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'expense'), 0)`,
      transactionCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .where(and(gte(transactions.occurredOn, start), lt(transactions.occurredOn, end)));

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

export async function getCategoryProgress(month: string): Promise<CategoryProgress[]> {
  const { start, end } = getMonthRange(month);

  const [cats, spentRows] = await Promise.all([
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
          gte(transactions.occurredOn, start),
          lt(transactions.occurredOn, end),
        ),
      )
      .groupBy(transactions.categoryId),
  ]);

  const spentMap = new Map(spentRows.map((row) => [row.categoryId, row.total]));

  const rows: CategoryProgress[] = cats.map((category) => {
    const spent = spentMap.get(category.id) ?? "0";
    const percent = category.monthlyLimit
      ? (Number(spent) / Number(category.monthlyLimit)) * 100
      : null;
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      monthlyLimit: category.monthlyLimit,
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

export type DailyExpense = { day: number; amount: number; cumulative: number };

export async function getDailyExpenses(month: string): Promise<DailyExpense[]> {
  const { start, end } = getMonthRange(month);

  const rows = await db
    .select({
      day: transactions.occurredOn,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.kind, "expense"),
        gte(transactions.occurredOn, start),
        lt(transactions.occurredOn, end),
      ),
    )
    .groupBy(transactions.occurredOn);

  const totalsByDay = new Map(rows.map((row) => [row.day, Number(row.total)]));

  const [year, m] = month.split("-").map(Number);
  const daysInMonth = new Date(year, m, 0).getDate();

  let cumulative = 0;
  const result: DailyExpense[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const isoDay = `${month}-${String(day).padStart(2, "0")}`;
    const amount = totalsByDay.get(isoDay) ?? 0;
    cumulative += amount;
    result.push({ day, amount, cumulative });
  }

  return result;
}

export async function getMonthlyExpenseLimit(): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${categories.monthlyLimit}), 0)`,
    })
    .from(categories)
    .where(and(eq(categories.kind, "expense"), isNull(categories.archivedAt)));

  return Number(row.total);
}

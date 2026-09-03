import "server-only";

import { and, asc, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, paymentMethods, transactions, users } from "@/db/schema";

export type HistoryFilters = {
  from?: string;
  to?: string;
  categoryIds?: string[];
  paidByUserId?: string;
  scope?: "shared" | "personal";
  paymentMethodId?: string;
  search?: string;
  sort?: "date" | "amount";
  order?: "asc" | "desc";
};

const PAGE_SIZE = 30;

function buildWhere(filters: HistoryFilters) {
  const conditions = [];

  if (filters.from) conditions.push(gte(transactions.occurredOn, filters.from));
  if (filters.to) conditions.push(lte(transactions.occurredOn, filters.to));
  if (filters.categoryIds?.length) {
    conditions.push(inArray(transactions.categoryId, filters.categoryIds));
  }
  if (filters.paidByUserId) {
    conditions.push(eq(transactions.paidByUserId, filters.paidByUserId));
  }
  if (filters.scope) conditions.push(eq(transactions.scope, filters.scope));
  if (filters.paymentMethodId) {
    conditions.push(eq(transactions.paymentMethodId, filters.paymentMethodId));
  }
  if (filters.search) {
    conditions.push(ilike(transactions.note, `%${filters.search}%`));
  }

  return conditions.length ? and(...conditions) : undefined;
}

export async function getHistoryRows(filters: HistoryFilters, page: number) {
  const where = buildWhere(filters);
  const sortColumn =
    filters.sort === "amount" ? transactions.amount : transactions.occurredOn;
  const orderFn = filters.order === "asc" ? asc : desc;

  const rows = await db
    .select({
      id: transactions.id,
      occurredOn: transactions.occurredOn,
      kind: transactions.kind,
      amount: transactions.amount,
      note: transactions.note,
      scope: transactions.scope,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      paidByUserId: transactions.paidByUserId,
      paidByName: users.displayName,
      paymentMethodId: transactions.paymentMethodId,
      paymentMethodName: paymentMethods.name,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(users, eq(transactions.paidByUserId, users.id))
    .leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
    .where(where)
    .orderBy(orderFn(sortColumn), desc(transactions.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(where);

  const [{ expenseTotal, incomeTotal }] = await db
    .select({
      expenseTotal: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'expense'), 0)`,
      incomeTotal: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'income'), 0)`,
    })
    .from(transactions)
    .where(where);

  return {
    rows,
    total: count,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(count / PAGE_SIZE)),
    expenseTotal,
    incomeTotal,
  };
}

export async function getHistoryRowsForExport(filters: HistoryFilters) {
  const where = buildWhere(filters);
  const sortColumn =
    filters.sort === "amount" ? transactions.amount : transactions.occurredOn;
  const orderFn = filters.order === "asc" ? asc : desc;

  return db
    .select({
      occurredOn: transactions.occurredOn,
      kind: transactions.kind,
      amount: transactions.amount,
      categoryName: categories.name,
      paidByName: users.displayName,
      scope: transactions.scope,
      paymentMethodName: paymentMethods.name,
      note: transactions.note,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(users, eq(transactions.paidByUserId, users.id))
    .leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
    .where(where)
    .orderBy(orderFn(sortColumn), desc(transactions.createdAt));
}

export async function getRecentTransactions(limit: number) {
  return db
    .select({
      id: transactions.id,
      occurredOn: transactions.occurredOn,
      kind: transactions.kind,
      amount: transactions.amount,
      note: transactions.note,
      categoryName: categories.name,
      categoryColor: categories.color,
      paidByName: users.displayName,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(users, eq(transactions.paidByUserId, users.id))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(limit);
}

export async function getTransactionById(id: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);
  return row ?? null;
}

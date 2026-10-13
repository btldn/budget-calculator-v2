import "server-only";

import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  categoryLimits,
  paycheckAllocations,
  paychecks,
  paySchedules,
  transactions,
} from "@/db/schema";
import { moneyFormat } from "@/lib/format";
import type { MoneyFormat } from "@/lib/format-client";
import { toCents } from "@/lib/payday/distribute";
import { reallocateCategories, type Reallocation } from "@/lib/payday/reallocate";
import {
  daysBetween,
  isPaydayDue,
  nextPaydayAfter,
  toIsoDate,
} from "@/lib/payday/schedule";
import { getGoals } from "@/lib/queries/goals";

import { getCurrentMonth, getMonthRange, getPreviousMonth } from "./dashboard";

export type PaySlot = { id: string; label: string; dayOfMonth: number };

// Выплаты одного человека в порядке числа месяца: «Аванс — 10», «Зарплата — 25».
export async function getPaySchedules(userId: string): Promise<PaySlot[]> {
  return db
    .select({
      id: paySchedules.id,
      label: paySchedules.label,
      dayOfMonth: paySchedules.dayOfMonth,
    })
    .from(paySchedules)
    .where(eq(paySchedules.userId, userId))
    .orderBy(asc(paySchedules.dayOfMonth), asc(paySchedules.createdAt));
}

// Сколько месяцев истории берём, чтобы прикинуть, сколько уходит «на жизнь».
const HISTORY_MONTHS = 3;

// Траты человека по месяцам и категориям за последние полные месяцы, без
// пополнений целей. Агрегация в БД; сворачивание по месяцам — в вызывающем коде.
async function getRecentSpendByMonthAndCategory(userId: string) {
  const currentMonth = getCurrentMonth();
  let firstMonth = currentMonth;
  for (let i = 0; i < HISTORY_MONTHS; i++) firstMonth = getPreviousMonth(firstMonth);

  const monthExpr = sql<string>`to_char(${transactions.occurredOn}, 'YYYY-MM')`;

  return db
    .select({
      month: monthExpr,
      categoryId: transactions.categoryId,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.kind, "expense"),
        isNull(transactions.goalId),
        eq(transactions.paidByUserId, userId),
        gte(transactions.occurredOn, getMonthRange(firstMonth).start),
        lt(transactions.occurredOn, getMonthRange(currentMonth).start),
      ),
    )
    .groupBy(monthExpr, transactions.categoryId);
}

export type PaydayContext = {
  moneyFormat: MoneyFormat;
  slots: PaySlot[];
  // Категории расходов, у которых у этого человека есть лимит.
  categories: {
    id: string;
    name: string;
    color: string;
    monthlyLimit: number;
    payScheduleId: string | null;
  }[];
  // Цели строго в порядке приоритета.
  goals: {
    id: string;
    title: string;
    targetAmount: string;
    savedAmount: string;
    deadline: string | null;
    depositedThisMonth: number;
  }[];
  incomeCategories: { id: string; name: string }[];
  lastRegular: { receivedOn: string; payScheduleId: string | null } | null;
  // Сколько пришло в прошлый раз по каждой выплате — подставляем в поле суммы.
  lastAmountBySlot: Record<string, number>;
  // Сколько в месяц в среднем уходит «на жизнь» сверх лимитов категорий.
  reserveMonthly: number;
  // Сколько всего тратится в месяц в среднем — для ориентира по подушке.
  avgMonthlySpend: number;
  // Сколько сэкономили в прошлом периоде (от прошлой зарплаты до сегодня).
  previousPeriodSaved: number;
};

export async function getPaydayContext(userId: string): Promise<PaydayContext> {
  const month = getMonthRange(getCurrentMonth());

  const [
    slots,
    limitRows,
    goalRows,
    depositRows,
    incomeCategories,
    recentPaychecks,
    spendRows,
  ] = await Promise.all([
    getPaySchedules(userId),
    db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        monthlyLimit: categoryLimits.monthlyLimit,
        payScheduleId: categoryLimits.payScheduleId,
      })
      .from(categoryLimits)
      .innerJoin(categories, eq(categoryLimits.categoryId, categories.id))
      .where(
        and(
          eq(categoryLimits.userId, userId),
          eq(categories.kind, "expense"),
          isNull(categories.archivedAt),
        ),
      )
      .orderBy(asc(categories.sortOrder)),
    getGoals(),
    db
      .select({
        goalId: transactions.goalId,
        total: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          isNotNull(transactions.goalId),
          eq(transactions.kind, "expense"),
          gte(transactions.occurredOn, month.start),
          lt(transactions.occurredOn, month.end),
        ),
      )
      .groupBy(transactions.goalId),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.kind, "income"), isNull(categories.archivedAt)))
      .orderBy(asc(categories.sortOrder)),
    db
      .select()
      .from(paychecks)
      .where(and(eq(paychecks.userId, userId), eq(paychecks.isExtra, false)))
      .orderBy(desc(paychecks.receivedOn), desc(paychecks.createdAt))
      .limit(20),
    getRecentSpendByMonthAndCategory(userId),
  ]);

  const limitByCategory = new Map(
    limitRows.map((row) => [row.id, Number(row.monthlyLimit)]),
  );

  // «Мимо лимитов» за месяц: траты в категориях без лимита плюс превышение
  // лимитов. Среднее — по месяцам, в которых вообще были траты.
  const outsideByMonth = new Map<string, number>();
  const spentByMonth = new Map<string, number>();
  for (const row of spendRows) {
    const spent = Number(row.total);
    const limit = limitByCategory.get(row.categoryId) ?? 0;
    outsideByMonth.set(row.month, (outsideByMonth.get(row.month) ?? 0) + Math.max(0, spent - limit));
    spentByMonth.set(row.month, (spentByMonth.get(row.month) ?? 0) + spent);
  }
  const monthsWithData = spentByMonth.size;
  const average = (byMonth: Map<string, number>) =>
    monthsWithData === 0
      ? 0
      : [...byMonth.values()].reduce((sum, value) => sum + value, 0) / monthsWithData;

  const depositedByGoal = new Map(
    depositRows.map((row) => [row.goalId, Number(row.total)]),
  );

  const lastRegular = recentPaychecks[0] ?? null;

  const lastAmountBySlot: Record<string, number> = {};
  for (const paycheck of recentPaychecks) {
    if (paycheck.payScheduleId && !(paycheck.payScheduleId in lastAmountBySlot)) {
      lastAmountBySlot[paycheck.payScheduleId] = Number(paycheck.amount);
    }
  }

  let previousPeriodSaved = 0;
  if (lastRegular) {
    const [[allocated], [spent]] = await Promise.all([
      db
        .select({ total: sql<string>`coalesce(sum(${paycheckAllocations.amount}), 0)` })
        .from(paycheckAllocations)
        .where(eq(paycheckAllocations.paycheckId, lastRegular.id)),
      db
        .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.kind, "expense"),
            isNull(transactions.goalId),
            eq(transactions.paidByUserId, userId),
            gte(transactions.occurredOn, lastRegular.receivedOn),
          ),
        ),
    ]);
    previousPeriodSaved = Math.max(
      0,
      Number(allocated.total) + Number(lastRegular.reserveAmount) - Number(spent.total),
    );
  }

  return {
    moneyFormat: moneyFormat(),
    slots,
    categories: limitRows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      monthlyLimit: Number(row.monthlyLimit),
      payScheduleId: row.payScheduleId,
    })),
    goals: goalRows.map((goal) => ({
      id: goal.id,
      title: goal.title,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      deadline: goal.deadline,
      depositedThisMonth: depositedByGoal.get(goal.id) ?? 0,
    })),
    incomeCategories,
    lastRegular: lastRegular
      ? { receivedOn: lastRegular.receivedOn, payScheduleId: lastRegular.payScheduleId }
      : null,
    lastAmountBySlot,
    reserveMonthly: Math.round(average(outsideByMonth)),
    avgMonthlySpend: Math.round(average(spentByMonth)),
    previousPeriodSaved: Math.round(previousPeriodSaved),
  };
}

export type PaycheckHistoryRow = {
  id: string;
  receivedOn: string;
  amount: string;
  isExtra: boolean;
  slotLabel: string | null;
};

export async function getPaycheckHistory(userId: string): Promise<PaycheckHistoryRow[]> {
  return db
    .select({
      id: paychecks.id,
      receivedOn: paychecks.receivedOn,
      amount: paychecks.amount,
      isExtra: paychecks.isExtra,
      slotLabel: paySchedules.label,
    })
    .from(paychecks)
    .leftJoin(paySchedules, eq(paychecks.payScheduleId, paySchedules.id))
    .where(eq(paychecks.userId, userId))
    .orderBy(desc(paychecks.receivedOn), desc(paychecks.createdAt))
    .limit(24);
}

// Нужна ли человеку подсказка «пришла зарплата»: график не задан, выплат ещё не
// вносили или плановая выплата уже наступила, а в приложении её нет.
export type PaydayStatus =
  | { kind: "no-schedule" }
  | { kind: "no-paychecks" }
  | { kind: "ready"; due: boolean };

export async function getPaydayStatus(userId: string): Promise<PaydayStatus> {
  const [slots, [last]] = await Promise.all([
    getPaySchedules(userId),
    db
      .select({ receivedOn: paychecks.receivedOn, payScheduleId: paychecks.payScheduleId })
      .from(paychecks)
      .where(and(eq(paychecks.userId, userId), eq(paychecks.isExtra, false)))
      .orderBy(desc(paychecks.receivedOn), desc(paychecks.createdAt))
      .limit(1),
  ]);

  if (slots.length === 0) return { kind: "no-schedule" };
  if (!last) return { kind: "no-paychecks" };

  return { kind: "ready", due: isPaydayDue(slots, last, new Date()) };
}

export type PeriodTile = {
  id: string;
  name: string;
  color: string | null;
  // Обязательный платёж (аренда, коммуналка): на плашке есть кнопка «Заплатил».
  fixed: boolean;
  allocated: number;
  spent: number;
  remaining: number;
};

export type PeriodBudget = {
  // Расписание следующей выплаты: до какого дня рассчитан бюджет.
  periodEnd: string | null;
  daysLeft: number | null;
  // По категориям, на которые в этом периоде выделены деньги.
  tiles: PeriodTile[];
  // «Запас на жизнь» (null — резерва в периоде не было и тратить из него не пришлось).
  reserve: PeriodTile | null;
  // Сколько ещё можно потратить: сумма остатков без обязательных платежей,
  // перерасход одной категории не «съедает» остаток другой.
  spendable: number;
  // Сколько ещё предстоит оплатить по обязательным платежам (аренда, коммуналка).
  fixedRemaining: number;
};

// Пока обязательные платежи определяются по названию категории. Если
// категорию переименовать, её остаток вернётся в «можно потратить» —
// надёжнее будет переключатель «Обязательный платёж» в настройках.
const FIXED_CATEGORY_NAMES = new Set(["Жильё / аренда", "Коммуналка"]);

// Бюджет текущего периода «от зарплаты до зарплаты» по выбранным людям. Период
// каждого человека начинается с его последней обычной выплаты; null — ни у
// кого из выбранных выплат ещё не было.
export async function getCurrentPeriodBudget(userIds: string[]): Promise<PeriodBudget | null> {
  if (userIds.length === 0) return null;

  const regular = await db
    .select()
    .from(paychecks)
    .where(and(inArray(paychecks.userId, userIds), eq(paychecks.isExtra, false)))
    .orderBy(desc(paychecks.receivedOn), desc(paychecks.createdAt));

  const lastByUser = new Map<string, (typeof regular)[number]>();
  for (const paycheck of regular) {
    if (!lastByUser.has(paycheck.userId)) lastByUser.set(paycheck.userId, paycheck);
  }
  if (lastByUser.size === 0) return null;

  const spentSum = sql<string>`sum(${transactions.amount})`;

  const perUser = await Promise.all(
    [...lastByUser.entries()].map(async ([userId, last]) => {
      const start = last.receivedOn;
      const [slots, allocations, reserveRows, spentRows] = await Promise.all([
        getPaySchedules(userId),
        db
          .select({
            categoryId: paycheckAllocations.categoryId,
            total: sql<string>`sum(${paycheckAllocations.amount})`,
          })
          .from(paycheckAllocations)
          .innerJoin(paychecks, eq(paycheckAllocations.paycheckId, paychecks.id))
          .where(and(eq(paychecks.userId, userId), gte(paychecks.receivedOn, start)))
          .groupBy(paycheckAllocations.categoryId),
        db
          .select({ total: sql<string>`coalesce(sum(${paychecks.reserveAmount}), 0)` })
          .from(paychecks)
          .where(and(eq(paychecks.userId, userId), gte(paychecks.receivedOn, start))),
        db
          .select({ categoryId: transactions.categoryId, total: spentSum })
          .from(transactions)
          .where(
            and(
              eq(transactions.kind, "expense"),
              isNull(transactions.goalId),
              eq(transactions.paidByUserId, userId),
              gte(transactions.occurredOn, start),
            ),
          )
          .groupBy(transactions.categoryId),
      ]);

      const slot = slots.find((s) => s.id === last.payScheduleId);
      const next = nextPaydayAfter(slots, slot, last.receivedOn);

      return {
        allocations,
        reserve: Number(reserveRows[0]?.total ?? 0),
        spent: spentRows,
        next: next?.date ?? null,
      };
    }),
  );

  const allocated = new Map<string, number>();
  const spent = new Map<string, number>();
  let reserveAllocated = 0;
  for (const user of perUser) {
    reserveAllocated += user.reserve;
    for (const row of user.allocations) {
      allocated.set(row.categoryId, (allocated.get(row.categoryId) ?? 0) + Number(row.total));
    }
    for (const row of user.spent) {
      spent.set(row.categoryId, (spent.get(row.categoryId) ?? 0) + Number(row.total));
    }
  }

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name, color: categories.color })
    .from(categories)
    .where(and(eq(categories.kind, "expense"), isNull(categories.archivedAt)))
    .orderBy(asc(categories.sortOrder));

  const tiles: PeriodTile[] = categoryRows
    .filter((category) => (allocated.get(category.id) ?? 0) > 0)
    .map((category) => {
      const allocatedAmount = allocated.get(category.id) ?? 0;
      const spentAmount = spent.get(category.id) ?? 0;
      return {
        id: category.id,
        name: category.name,
        color: category.color,
        fixed: FIXED_CATEGORY_NAMES.has(category.name),
        allocated: allocatedAmount,
        spent: spentAmount,
        remaining: allocatedAmount - spentAmount,
      };
    });

  // Траты в категориях, на которые деньги в этом периоде не выделялись, берутся
  // из «запаса на жизнь».
  let outsideSpent = 0;
  for (const [categoryId, amount] of spent) {
    if ((allocated.get(categoryId) ?? 0) <= 0) outsideSpent += amount;
  }

  const reserve: PeriodTile | null =
    reserveAllocated > 0 || outsideSpent > 0
      ? {
          id: "reserve",
          name: "Запас на жизнь",
          color: null,
          fixed: false,
          allocated: reserveAllocated,
          spent: outsideSpent,
          remaining: reserveAllocated - outsideSpent,
        }
      : null;

  // Остаток по обязательным платежам — это деньги на аренду и коммуналку, а не
  // на траты, поэтому в «можно потратить» они не входят.
  const isFixed = (tile: PeriodTile) => tile.fixed;
  const positive = (tile: PeriodTile) => Math.max(0, tile.remaining);
  const fixedRemaining = tiles.filter(isFixed).reduce((sum, tile) => sum + positive(tile), 0);
  const spendable =
    tiles.filter((tile) => !isFixed(tile)).reduce((sum, tile) => sum + positive(tile), 0) +
    Math.max(0, reserve?.remaining ?? 0);

  const upcoming = perUser
    .map((user) => user.next)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const today = new Date();

  return {
    periodEnd: upcoming ? toIsoDate(upcoming) : null,
    daysLeft: upcoming ? Math.max(1, daysBetween(today, upcoming)) : null,
    tiles,
    reserve,
    spendable,
    fixedRemaining,
  };
}

export type AllocationPlan = Reallocation & { paycheckId: string };

// Что получилось бы, если бы последнюю обычную выплату человека распределили по
// сегодняшним лимитам. Цели и запас остаются как были подтверждены, а остальное
// из суммы выплаты заново делится между категориями.
export async function computeReallocation(userId: string): Promise<AllocationPlan | null> {
  const [last] = await db
    .select()
    .from(paychecks)
    .where(and(eq(paychecks.userId, userId), eq(paychecks.isExtra, false)))
    .orderBy(desc(paychecks.receivedOn), desc(paychecks.createdAt))
    .limit(1);
  if (!last) return null;

  const [slots, limitRows, storedRows, [deposits]] = await Promise.all([
    getPaySchedules(userId),
    db
      .select({
        id: categories.id,
        monthlyLimit: categoryLimits.monthlyLimit,
        payScheduleId: categoryLimits.payScheduleId,
      })
      .from(categoryLimits)
      .innerJoin(categories, eq(categoryLimits.categoryId, categories.id))
      .where(
        and(
          eq(categoryLimits.userId, userId),
          eq(categories.kind, "expense"),
          isNull(categories.archivedAt),
        ),
      ),
    db
      .select({ categoryId: paycheckAllocations.categoryId, amount: paycheckAllocations.amount })
      .from(paycheckAllocations)
      .where(eq(paycheckAllocations.paycheckId, last.id)),
    db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.paycheckId, last.id), isNotNull(transactions.goalId))),
  ]);

  const poolCents = toCents(last.amount) - toCents(deposits.total) - toCents(last.reserveAmount);

  const reallocation = reallocateCategories({
    poolCents,
    slotCount: slots.length || 1,
    paySlotId: last.payScheduleId,
    categories: limitRows.map((row) => ({
      id: row.id,
      monthlyLimitCents: toCents(row.monthlyLimit),
      payScheduleId: row.payScheduleId,
    })),
    stored: new Map(storedRows.map((row) => [row.categoryId, toCents(row.amount)])),
  });

  return { paycheckId: last.id, ...reallocation };
}

export type AllocationDrift = {
  paycheckId: string;
  // Суммы в валюте: что было в раскладке и что станет после обновления.
  changes: { categoryId: string; name: string; before: number; after: number }[];
};

// null — раскладка выплаты соответствует текущим лимитам.
export async function getAllocationDrift(userId: string): Promise<AllocationDrift | null> {
  const plan = await computeReallocation(userId);
  if (!plan || plan.changes.length === 0) return null;

  const names = new Map(
    (
      await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(inArray(categories.id, plan.changes.map((change) => change.categoryId)))
    ).map((row) => [row.id, row.name]),
  );

  return {
    paycheckId: plan.paycheckId,
    changes: plan.changes.map((change) => ({
      categoryId: change.categoryId,
      name: names.get(change.categoryId) ?? "Категория",
      before: change.beforeCents / 100,
      after: change.afterCents / 100,
    })),
  };
}

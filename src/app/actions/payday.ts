"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  categories,
  goals,
  paycheckAllocations,
  paychecks,
  paySchedules,
  transactions,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { adjustGoalSavedAmount, resolveSavingsCategoryId } from "@/lib/goal-deposits";
import {
  computeReallocation,
  getCurrentPeriodBudget,
  getPaydayContext,
  type PaydayContext,
} from "@/lib/queries/payday";
import {
  paycheckSchema,
  paySlotSchema,
  type PaycheckValues,
  type PaySlotFormValues,
} from "@/lib/validations/payday";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

// Выплата трогает и дашборд, и цели, и историю операций.
function revalidatePaydayPages() {
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/goals");
  revalidatePath("/history");
}

// Всё, что нужно диалогу «Пришла зарплата», одним запросом при его открытии.
export async function fetchPaydayContext(): Promise<PaydayContext | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;
  return getPaydayContext(currentUser.id);
}

// Сколько ещё можно потратить до следующей выплаты — для плиток категорий в
// окне «Добавить трату». null — зарплату ещё не вносили, остатков нет.
export type SpendContext = {
  // Остаток по категориям, на которые в этом периоде выделены деньги.
  remainingByCategory: Record<string, number>;
  // Остаток «запаса на жизнь»: из него идут траты вне выделенных категорий.
  reserveRemaining: number | null;
};

export async function fetchSpendContext(): Promise<SpendContext | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const budget = await getCurrentPeriodBudget([currentUser.id]);
  if (!budget) return null;

  return {
    remainingByCategory: Object.fromEntries(budget.tiles.map((tile) => [tile.id, tile.remaining])),
    reserveRemaining: budget.reserve ? budget.reserve.remaining : null,
  };
}

// Записывает выплату вместе с раскладкой, которую подтвердил человек: доход,
// выделенное на категории (период «от зп до зп») и пополнения целей. Всё одной
// транзакцией БД; пополнения помечены paycheck_id, чтобы выплату можно было
// откатить целиком.
export async function recordPaycheck(
  input: PaycheckValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = paycheckSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля формы.",
    };
  }
  const values = parsed.data;

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Не удалось определить пользователя." };
  }

  const paySlotId = values.isExtra ? null : values.paySlotId;

  if (paySlotId) {
    const [slot] = await db
      .select({ id: paySchedules.id })
      .from(paySchedules)
      .where(and(eq(paySchedules.id, paySlotId), eq(paySchedules.userId, currentUser.id)));
    if (!slot) {
      return { success: false, error: "Такой выплаты нет в графике. Обновите страницу." };
    }
  }

  const [incomeCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, values.incomeCategoryId), eq(categories.kind, "income")));
  if (!incomeCategory) {
    return { success: false, error: "Выберите категорию дохода." };
  }

  const depositedGoals = values.goals.filter((row) => row.amount > 0);
  const goalRows = depositedGoals.length
    ? await db
        .select({ id: goals.id, title: goals.title })
        .from(goals)
        .where(
          and(
            inArray(
              goals.id,
              depositedGoals.map((row) => row.goalId),
            ),
            isNull(goals.archivedAt),
          ),
        )
    : [];
  const titleByGoal = new Map(goalRows.map((goal) => [goal.id, goal.title]));
  if (depositedGoals.some((row) => !titleByGoal.has(row.goalId))) {
    return { success: false, error: "Одной из целей уже нет. Обновите страницу." };
  }

  const row = await db.transaction(async (tx) => {
    const [paycheck] = await tx
      .insert(paychecks)
      .values({
        userId: currentUser.id,
        payScheduleId: paySlotId,
        isExtra: values.isExtra,
        receivedOn: values.receivedOn,
        amount: values.amount.toFixed(2),
        reserveAmount: values.reserve.toFixed(2),
      })
      .returning({ id: paychecks.id });

    await tx.insert(transactions).values({
      occurredOn: values.receivedOn,
      kind: "income",
      amount: values.amount.toFixed(2),
      categoryId: values.incomeCategoryId,
      paidByUserId: currentUser.id,
      scope: "personal",
      note: values.isExtra ? "Внеплановая выплата" : "Зарплата",
      paycheckId: paycheck.id,
      createdByUserId: currentUser.id,
    });

    const allocations = values.categories.filter((category) => category.amount > 0);
    if (allocations.length > 0) {
      await tx.insert(paycheckAllocations).values(
        allocations.map((category) => ({
          paycheckId: paycheck.id,
          categoryId: category.categoryId,
          amount: category.amount.toFixed(2),
        })),
      );
    }

    if (depositedGoals.length > 0) {
      const savingsCategoryId = await resolveSavingsCategoryId(tx);
      for (const deposit of depositedGoals) {
        await tx.insert(transactions).values({
          occurredOn: values.receivedOn,
          kind: "expense",
          amount: deposit.amount.toFixed(2),
          categoryId: savingsCategoryId,
          paidByUserId: currentUser.id,
          scope: "personal",
          goalId: deposit.goalId,
          note: `С зарплаты: ${titleByGoal.get(deposit.goalId)}`,
          paycheckId: paycheck.id,
          createdByUserId: currentUser.id,
        });
        await adjustGoalSavedAmount(tx, deposit.goalId, deposit.amount.toFixed(2));
      }
    }

    return paycheck;
  });

  revalidatePaydayPages();

  return { success: true, data: { id: row.id } };
}

// «Обновить раскладку»: пересчитывает долю последней обычной выплаты на категории
// по сегодняшним лимитам (добавили категорию, поменяли лимит после зарплаты).
// Клиенту доверяем только id выплаты: сам план считается здесь заново.
export async function applyAllocationDrift(paycheckId: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Не удалось определить пользователя." };
  }

  const plan = await computeReallocation(currentUser.id);
  if (!plan || plan.paycheckId !== paycheckId) {
    return { success: false, error: "Раскладка уже изменилась. Обновите страницу." };
  }
  if (plan.changes.length === 0) {
    return { success: true, data: undefined };
  }

  await db.transaction(async (tx) => {
    await tx.delete(paycheckAllocations).where(eq(paycheckAllocations.paycheckId, paycheckId));
    if (plan.allocations.length > 0) {
      await tx.insert(paycheckAllocations).values(
        plan.allocations.map((allocation) => ({
          paycheckId,
          categoryId: allocation.categoryId,
          amount: (allocation.amountCents / 100).toFixed(2),
        })),
      );
    }
  });

  revalidatePaydayPages();

  return { success: true, data: undefined };
}

// Откат выплаты: возвращает в цели то, что из них было «отложено» этой
// выплатой, удаляет её операции и саму выплату (раскладка уходит каскадом).
export async function deletePaycheck(id: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Не удалось определить пользователя." };
  }

  const deleted = await db.transaction(async (tx) => {
    const [paycheck] = await tx
      .select({ id: paychecks.id })
      .from(paychecks)
      .where(and(eq(paychecks.id, id), eq(paychecks.userId, currentUser.id)));
    if (!paycheck) return false;

    const operations = await tx
      .select({ goalId: transactions.goalId, amount: transactions.amount })
      .from(transactions)
      .where(eq(transactions.paycheckId, id));

    for (const operation of operations) {
      if (operation.goalId) {
        await adjustGoalSavedAmount(tx, operation.goalId, `-${operation.amount}`);
      }
    }

    await tx.delete(transactions).where(eq(transactions.paycheckId, id));
    await tx.delete(paychecks).where(eq(paychecks.id, id));
    return true;
  });

  if (!deleted) {
    return { success: false, error: "Выплата не найдена — возможно, её уже откатили." };
  }

  revalidatePaydayPages();

  return { success: true, data: undefined };
}

// График выплат всегда принадлежит текущему пользователю: чужую строку
// ни изменить, ни удалить, даже зная её id.
export async function createPaySlot(
  input: PaySlotFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = paySlotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля формы.",
    };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Не удалось определить пользователя." };
  }

  const [row] = await db
    .insert(paySchedules)
    .values({
      userId: currentUser.id,
      label: parsed.data.label,
      dayOfMonth: parsed.data.dayOfMonth,
    })
    .returning({ id: paySchedules.id });

  revalidatePaydayPages();

  return { success: true, data: { id: row.id } };
}

export async function updatePaySlot(
  id: string,
  input: PaySlotFormValues,
): Promise<ActionResult> {
  const parsed = paySlotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля формы.",
    };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Не удалось определить пользователя." };
  }

  await db
    .update(paySchedules)
    .set({ label: parsed.data.label, dayOfMonth: parsed.data.dayOfMonth })
    .where(and(eq(paySchedules.id, id), eq(paySchedules.userId, currentUser.id)));

  revalidatePaydayPages();

  return { success: true, data: undefined };
}

// Выплаты и лимиты, ссылавшиеся на эту строку, не удаляются — у них просто
// сбрасывается привязка (on delete set null в схеме).
export async function deletePaySlot(id: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Не удалось определить пользователя." };
  }

  await db
    .delete(paySchedules)
    .where(and(eq(paySchedules.id, id), eq(paySchedules.userId, currentUser.id)));

  revalidatePaydayPages();

  return { success: true, data: undefined };
}

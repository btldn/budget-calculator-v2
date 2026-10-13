// Распределение выплаты: сколько на категории расходов, сколько на цели, сколько
// оставить «на жизнь». Чистая функция без обращения к БД — всё нужное приходит
// во входе. Деньги везде в целых копейках, чтобы части в сумме давали ровно
// выплату; в валюту и обратно переводят toCents / fromCents.

const UNIT = 100;

export function toCents(value: string | number): number {
  return Math.round(Number(value) * UNIT);
}

export function fromCents(cents: number): number {
  return cents / UNIT;
}

// Деление на несколько выплат округляем до целых единиц валюты: «7 500», а не
// «7 499,67» — иначе цифры в диалоге нечитаемы.
function roundToUnit(cents: number): number {
  return Math.round(cents / UNIT) * UNIT;
}

export type DistributeCategory = {
  id: string;
  monthlyLimitCents: number;
  // Выплата, из которой категория оплачивается целиком; null — поровну.
  payScheduleId: string | null;
};

export type DistributeGoal = {
  id: string;
  // Сколько ещё не хватает до цели.
  remainingCents: number;
  // Месяцев до срока (≥ 1); null — у цели нет срока или он прошёл.
  months: number | null;
  // Сколько в этом календарном месяце уже отложено в цель (кем угодно).
  depositedThisMonthCents: number;
};

export type DistributeInput = {
  amountCents: number;
  // Внеплановая выплата (премия): категории не покрывает, «запас на жизнь»
  // не добавляет — только цели.
  isExtra: boolean;
  // Сколько выплат в месяц в графике человека.
  slotCount: number;
  // Какая это выплата из графика; null — график не задан или выплата внеплановая.
  paySlotId: string | null;
  // Категории расходов, у которых есть лимит.
  categories: DistributeCategory[];
  // Цели строго в порядке приоритета: первая получает деньги первой.
  goals: DistributeGoal[];
  // Сколько в месяц обычно уходит «на жизнь» сверх лимитов категорий.
  reserveMonthlyCents: number;
  // Запас на эту выплату, заданный вручную вместо расчётного: цели считаются уже
  // после него, поэтому правка запаса сразу пересчитывает их.
  reservePerPaymentCents?: number;
};

export type CategoryAllocation = {
  categoryId: string;
  targetCents: number;
  amountCents: number;
};

export type GoalAllocation = {
  goalId: string;
  // Часть, нужная, чтобы успеть к сроку в этом месяце.
  byDeadlineCents: number;
  // Часть из остатка: цель выше по приоритету уже закрыта или упёрлась в потолок.
  byPriorityCents: number;
  totalCents: number;
};

export type Distribution = {
  categories: CategoryAllocation[];
  // Сколько не хватило до плана по категориям.
  categoriesShortfallCents: number;
  goals: GoalAllocation[];
  reserveCents: number;
  // Не влезло никуда — оставить на накопительном.
  unallocatedCents: number;
};

// Делит `available` по целям `targets` пропорционально, не превышая цель.
// Когда денег хватает на всё — каждый получает ровно свою цель. Недостающие
// копейки раздаются по наибольшим дробным частям, поэтому сумма частей всегда
// равна available.
function allocateUpTo(targets: number[], available: number): number[] {
  const total = targets.reduce((sum, target) => sum + target, 0);
  if (available >= total) return [...targets];
  if (available <= 0 || total === 0) return targets.map(() => 0);

  const exact = targets.map((target) => target * (available / total));
  const shares = exact.map(Math.floor);
  let leftover = available - shares.reduce((sum, share) => sum + share, 0);

  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - shares[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const { index } of byFraction) {
    if (leftover <= 0) break;
    if (shares[index] < targets[index]) {
      shares[index] += 1;
      leftover -= 1;
    }
  }

  return shares;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function distributePaycheck(input: DistributeInput): Distribution {
  const slotCount = Math.max(1, input.slotCount);
  // Доля месячной суммы, приходящаяся на одну выплату.
  const perPayment = (monthlyCents: number) =>
    slotCount === 1 ? monthlyCents : roundToUnit(monthlyCents / slotCount);

  let money = Math.max(0, input.amountCents);

  // 1. Категории (только обычная выплата). Закреплённые за этой выплатой
  // получают лимит целиком и идут первыми — это обязательные платежи вроде
  // аренды; остальные делят то, что осталось, пропорционально.
  const categoryRows = input.categories.map((category) => {
    const pinnedHere =
      input.paySlotId !== null && category.payScheduleId === input.paySlotId;
    const pinnedElsewhere =
      input.paySlotId !== null &&
      category.payScheduleId !== null &&
      category.payScheduleId !== input.paySlotId;

    let target = 0;
    if (!input.isExtra) {
      if (pinnedHere) target = category.monthlyLimitCents;
      else if (!pinnedElsewhere) target = perPayment(category.monthlyLimitCents);
    }
    return { categoryId: category.id, targetCents: target, pinned: pinnedHere };
  });

  const pinnedRows = categoryRows.filter((row) => row.pinned);
  const looseRows = categoryRows.filter((row) => !row.pinned);

  const pinnedAmounts = allocateUpTo(
    pinnedRows.map((row) => row.targetCents),
    money,
  );
  money -= sum(pinnedAmounts);
  const looseAmounts = allocateUpTo(
    looseRows.map((row) => row.targetCents),
    money,
  );
  money -= sum(looseAmounts);

  const amountByCategory = new Map<string, number>();
  pinnedRows.forEach((row, index) => amountByCategory.set(row.categoryId, pinnedAmounts[index]));
  looseRows.forEach((row, index) => amountByCategory.set(row.categoryId, looseAmounts[index]));

  const categories: CategoryAllocation[] = categoryRows.map((row) => ({
    categoryId: row.categoryId,
    targetCents: row.targetCents,
    amountCents: amountByCategory.get(row.categoryId) ?? 0,
  }));
  const categoriesShortfallCents =
    sum(categories.map((c) => c.targetCents)) - sum(categories.map((c) => c.amountCents));

  // 2. Цели со сроком — столько, чтобы успеть. «Нужно в этом месяце» считаем
  // от остатка на начало месяца (remaining + уже отложенное), иначе внесённое
  // вычиталось бы дважды: и из остатка, и из месячной нормы.
  const byDeadline = new Map<string, number>();
  for (const goal of input.goals) {
    if (goal.months === null || goal.remainingCents <= 0) continue;

    const monthStartNeed = Math.ceil(
      (goal.remainingCents + goal.depositedThisMonthCents) / goal.months,
    );
    const gap = Math.max(0, monthStartNeed - goal.depositedThisMonthCents);
    // Внеплановые деньги — не одна из плановых выплат, делить на их число нечего.
    const share = input.isExtra ? gap : Math.min(gap, perPayment(monthStartNeed));
    const give = Math.min(share, goal.remainingCents, money);

    byDeadline.set(goal.id, give);
    money -= give;
  }

  // 3. Запас на жизнь.
  const reserveWanted =
    input.reservePerPaymentCents ?? perPayment(Math.max(0, input.reserveMonthlyCents));
  const reserveCents = input.isExtra ? 0 : Math.min(Math.max(0, reserveWanted), money);
  money -= reserveCents;

  // 4. Остаток — по целям водопадом в порядке приоритета.
  const goals: GoalAllocation[] = input.goals.map((goal) => {
    const deadlinePart = byDeadline.get(goal.id) ?? 0;
    const room = Math.max(0, goal.remainingCents - deadlinePart);
    const priorityPart = Math.min(room, money);
    money -= priorityPart;

    return {
      goalId: goal.id,
      byDeadlineCents: deadlinePart,
      byPriorityCents: priorityPart,
      totalCents: deadlinePart + priorityPart,
    };
  });

  // 5. Что не влезло никуда.
  return {
    categories,
    categoriesShortfallCents,
    goals,
    reserveCents,
    unallocatedCents: money,
  };
}

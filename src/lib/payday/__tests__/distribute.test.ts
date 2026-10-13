import { describe, expect, it } from "vitest";

import {
  distributePaycheck,
  toCents,
  type DistributeCategory,
  type DistributeGoal,
  type DistributeInput,
  type Distribution,
} from "../distribute";

const ADVANCE = "slot-advance";
const SALARY = "slot-salary";

const rent: DistributeCategory = {
  id: "rent",
  monthlyLimitCents: toCents(25000),
  payScheduleId: ADVANCE,
};
const food: DistributeCategory = {
  id: "food",
  monthlyLimitCents: toCents(30000),
  payScheduleId: null,
};
const cafe: DistributeCategory = {
  id: "cafe",
  monthlyLimitCents: toCents(12000),
  payScheduleId: null,
};

function input(overrides: Partial<DistributeInput>): DistributeInput {
  return {
    amountCents: toCents(100000),
    isExtra: false,
    slotCount: 2,
    paySlotId: ADVANCE,
    categories: [rent, food, cafe],
    goals: [],
    reserveMonthlyCents: 0,
    ...overrides,
  };
}

function goal(overrides: Partial<DistributeGoal> & { id: string }): DistributeGoal {
  return { remainingCents: 0, months: null, depositedThisMonthCents: 0, ...overrides };
}

function categoryAmount(result: Distribution, id: string): number {
  return result.categories.find((c) => c.categoryId === id)!.amountCents;
}

function goalTotal(result: Distribution, id: string): number {
  return result.goals.find((g) => g.goalId === id)!.totalCents;
}

function totalDistributed(result: Distribution): number {
  return (
    result.categories.reduce((s, c) => s + c.amountCents, 0) +
    result.goals.reduce((s, g) => s + g.totalCents, 0) +
    result.reserveCents +
    result.unallocatedCents
  );
}

describe("distributePaycheck — категории", () => {
  it("делит лимит поровну между выплатами, если категория не закреплена", () => {
    const result = distributePaycheck(input({ paySlotId: SALARY }));

    expect(categoryAmount(result, "food")).toBe(toCents(15000));
    expect(categoryAmount(result, "cafe")).toBe(toCents(6000));
  });

  it("закреплённая категория целиком в своей выплате и ноль в чужой", () => {
    const inAdvance = distributePaycheck(input({ paySlotId: ADVANCE }));
    const inSalary = distributePaycheck(input({ paySlotId: SALARY }));

    expect(categoryAmount(inAdvance, "rent")).toBe(toCents(25000));
    expect(categoryAmount(inSalary, "rent")).toBe(0);
  });

  it("весь лимит достаётся категории, если выплата одна", () => {
    const result = distributePaycheck(input({ slotCount: 1, paySlotId: SALARY }));

    expect(categoryAmount(result, "food")).toBe(toCents(30000));
    expect(categoryAmount(result, "cafe")).toBe(toCents(12000));
  });

  it("при нехватке сначала закреплённые, остальное пропорционально", () => {
    // 30 000: аренда забирает 25 000, на еду и кафе остаётся 5 000 при плане 21 000.
    const result = distributePaycheck(input({ amountCents: toCents(30000) }));

    expect(categoryAmount(result, "rent")).toBe(toCents(25000));
    expect(categoryAmount(result, "food") + categoryAmount(result, "cafe")).toBe(toCents(5000));
    expect(categoryAmount(result, "food")).toBeGreaterThan(categoryAmount(result, "cafe"));
    expect(result.categoriesShortfallCents).toBe(toCents(16000));
    expect(result.unallocatedCents).toBe(0);
  });

  it("если денег не хватает даже на закреплённую, она получает всё", () => {
    const result = distributePaycheck(input({ amountCents: toCents(10000) }));

    expect(categoryAmount(result, "rent")).toBe(toCents(10000));
    expect(categoryAmount(result, "food")).toBe(0);
    expect(result.categoriesShortfallCents).toBe(toCents(36000));
  });

  it("внеплановая выплата категории не покрывает", () => {
    const result = distributePaycheck(
      input({ isExtra: true, paySlotId: null, amountCents: toCents(20000) }),
    );

    expect(result.categories.every((c) => c.amountCents === 0)).toBe(true);
    expect(result.categoriesShortfallCents).toBe(0);
    expect(result.unallocatedCents).toBe(toCents(20000));
  });
});

describe("distributePaycheck — цели и запас", () => {
  it("цель со сроком получает столько, чтобы успеть, поделённое на выплаты", () => {
    // 120 000 за 8 месяцев = 15 000 в месяц, две выплаты → 7 500 с каждой.
    const result = distributePaycheck(
      input({
        goals: [goal({ id: "trip", remainingCents: toCents(120000), months: 8 })],
      }),
    );

    expect(result.goals[0].byDeadlineCents).toBe(toCents(7500));
  });

  it("уже отложенное в этом месяце не вычитается дважды", () => {
    // Первая выплата отложила 7 500; остаток цели уже уменьшился до 112 500.
    const second = distributePaycheck(
      input({
        paySlotId: SALARY,
        goals: [
          goal({
            id: "trip",
            remainingCents: toCents(112500),
            months: 8,
            depositedThisMonthCents: toCents(7500),
          }),
        ],
      }),
    );

    expect(second.goals[0].byDeadlineCents).toBe(toCents(7500));
  });

  it("месячная норма уже закрыта — по сроку ничего не просит", () => {
    const result = distributePaycheck(
      input({
        goals: [
          goal({
            id: "trip",
            remainingCents: toCents(105000),
            months: 8,
            depositedThisMonthCents: toCents(15000),
          }),
        ],
      }),
    );

    expect(result.goals[0].byDeadlineCents).toBe(0);
  });

  it("цель со сроком идёт раньше запаса на жизнь, запас раньше остальных целей", () => {
    // После категорий (46 000) остаётся 10 000: срок 7 500, запас просит 5 000
    // за выплату — достаётся только 2 500, свободной цели ничего.
    const result = distributePaycheck(
      input({
        amountCents: toCents(46000 + 10000),
        reserveMonthlyCents: toCents(10000),
        goals: [
          goal({ id: "free", remainingCents: toCents(50000) }),
          goal({ id: "trip", remainingCents: toCents(120000), months: 8 }),
        ],
      }),
    );

    expect(goalTotal(result, "trip")).toBe(toCents(7500));
    expect(result.reserveCents).toBe(toCents(2500));
    expect(goalTotal(result, "free")).toBe(0);
    expect(result.unallocatedCents).toBe(0);
  });

  it("ручной запас вместо расчётного пересчитывает цели", () => {
    // После категорий (46 000) остаётся 54 000: запас 30 000, цели — оставшиеся 24 000.
    const result = distributePaycheck(
      input({
        reserveMonthlyCents: toCents(10000),
        reservePerPaymentCents: toCents(30000),
        goals: [goal({ id: "free", remainingCents: toCents(200000) })],
      }),
    );

    expect(result.reserveCents).toBe(toCents(30000));
    expect(goalTotal(result, "free")).toBe(toCents(24000));
    expect(totalDistributed(result)).toBe(toCents(100000));
  });

  it("ручной запас не превышает то, что осталось после трат и целей по сроку", () => {
    const result = distributePaycheck(
      input({
        amountCents: toCents(50000),
        reservePerPaymentCents: toCents(999999),
      }),
    );

    expect(result.reserveCents).toBe(toCents(4000));
    expect(result.unallocatedCents).toBe(0);
  });

  it("внеплановая выплата игнорирует ручной запас", () => {
    const result = distributePaycheck(
      input({ isExtra: true, paySlotId: null, reservePerPaymentCents: toCents(5000) }),
    );

    expect(result.reserveCents).toBe(0);
  });

  it("остаток раскладывается по целям водопадом с потолком на каждую", () => {
    // 100 000 − 46 000 категорий = 54 000: первая цель берёт свои 20 000,
    // вторая — 34 000 (до потолка 50 000 ещё далеко).
    const result = distributePaycheck(
      input({
        goals: [
          goal({ id: "first", remainingCents: toCents(20000) }),
          goal({ id: "second", remainingCents: toCents(50000) }),
        ],
      }),
    );

    expect(goalTotal(result, "first")).toBe(toCents(20000));
    expect(goalTotal(result, "second")).toBe(toCents(34000));
    expect(result.unallocatedCents).toBe(0);
  });

  it("водопад не вкладывает в цель больше, чем ей не хватает", () => {
    const result = distributePaycheck(
      input({
        goals: [goal({ id: "small", remainingCents: toCents(3000) })],
      }),
    );

    expect(goalTotal(result, "small")).toBe(toCents(3000));
    expect(result.unallocatedCents).toBe(toCents(54000 - 3000));
  });

  it("без целей остаток уходит в «не распределено»", () => {
    const result = distributePaycheck(input({}));

    expect(result.goals).toEqual([]);
    expect(result.unallocatedCents).toBe(toCents(100000 - 46000));
  });

  it("закрытые цели и цели с прошедшим сроком не ломают раскладку", () => {
    const result = distributePaycheck(
      input({
        goals: [
          goal({ id: "done", remainingCents: 0 }),
          goal({ id: "expired", remainingCents: toCents(5000), months: null }),
        ],
      }),
    );

    expect(goalTotal(result, "done")).toBe(0);
    expect(goalTotal(result, "expired")).toBe(toCents(5000));
  });

  it("внеплановая выплата закрывает месячную норму по сроку целиком, а запас не добавляет", () => {
    const result = distributePaycheck(
      input({
        isExtra: true,
        paySlotId: null,
        amountCents: toCents(30000),
        reserveMonthlyCents: toCents(10000),
        goals: [goal({ id: "trip", remainingCents: toCents(120000), months: 8 })],
      }),
    );

    expect(result.reserveCents).toBe(0);
    // Норма в месяц 15 000, а дальше цель добирает остаток по приоритету.
    expect(result.goals[0].byDeadlineCents).toBe(toCents(15000));
    expect(result.goals[0].byPriorityCents).toBe(toCents(15000));
    expect(result.unallocatedCents).toBe(0);
  });
});

describe("distributePaycheck — инварианты", () => {
  it("части всегда в сумме дают ровно выплату и не уходят в минус", () => {
    // Детерминированный генератор, чтобы тест не мигал.
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let run = 0; run < 300; run++) {
      const amountCents = Math.round(random() * 20_000_000);
      const result = distributePaycheck({
        amountCents,
        isExtra: random() < 0.2,
        slotCount: 1 + Math.floor(random() * 3),
        paySlotId: random() < 0.5 ? ADVANCE : SALARY,
        categories: [rent, food, cafe].map((category) => ({
          ...category,
          monthlyLimitCents: Math.round(random() * 5_000_000),
        })),
        goals: Array.from({ length: Math.floor(random() * 4) }, (_, index) =>
          goal({
            id: `g${index}`,
            remainingCents: Math.round(random() * 10_000_000),
            months: random() < 0.5 ? 1 + Math.floor(random() * 12) : null,
            depositedThisMonthCents: Math.round(random() * 500_000),
          }),
        ),
        reserveMonthlyCents: Math.round(random() * 3_000_000),
      });

      expect(totalDistributed(result)).toBe(amountCents);
      expect(result.unallocatedCents).toBeGreaterThanOrEqual(0);
      expect(result.reserveCents).toBeGreaterThanOrEqual(0);
      for (const category of result.categories) {
        expect(category.amountCents).toBeGreaterThanOrEqual(0);
        expect(category.amountCents).toBeLessThanOrEqual(category.targetCents);
      }
    }
  });

  it("нулевая выплата ничего не раздаёт", () => {
    const result = distributePaycheck(input({ amountCents: 0 }));

    expect(totalDistributed(result)).toBe(0);
    expect(result.categoriesShortfallCents).toBeGreaterThan(0);
  });
});

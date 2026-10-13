import { describe, expect, it } from "vitest";

import { toCents, type DistributeCategory } from "../distribute";
import { reallocateCategories } from "../reallocate";

const ADVANCE = "slot-advance";
const SALARY = "slot-salary";

const rent: DistributeCategory = {
  id: "rent",
  monthlyLimitCents: toCents(25000),
  payScheduleId: ADVANCE,
};
const food: DistributeCategory = { id: "food", monthlyLimitCents: toCents(30000), payScheduleId: null };
const cafe: DistributeCategory = { id: "cafe", monthlyLimitCents: toCents(12000), payScheduleId: null };
const lunches: DistributeCategory = { id: "lunch", monthlyLimitCents: toCents(10000), payScheduleId: null };

function stored(entries: Record<string, number>) {
  return new Map(Object.entries(entries).map(([id, units]) => [id, toCents(units)]));
}

describe("reallocateCategories", () => {
  it("лимиты не менялись — раскладка актуальна", () => {
    // Зарплата (5-го): аренда закреплена за авансом, остальные делятся пополам.
    const result = reallocateCategories({
      poolCents: toCents(100000),
      slotCount: 2,
      paySlotId: SALARY,
      categories: [rent, food, cafe],
      stored: stored({ food: 15000, cafe: 6000 }),
    });

    expect(result.changes).toEqual([]);
  });

  it("новая категория получает долю лимита, когда денег хватает", () => {
    const result = reallocateCategories({
      poolCents: toCents(100000),
      slotCount: 2,
      paySlotId: SALARY,
      categories: [rent, food, cafe, lunches],
      stored: stored({ food: 15000, cafe: 6000 }),
    });

    expect(result.changes).toEqual([
      { categoryId: "lunch", beforeCents: 0, afterCents: toCents(5000) },
    ]);
    expect(result.allocations).toContainEqual({ categoryId: "lunch", amountCents: toCents(5000) });
  });

  it("при нехватке денег новая категория забирает долю у остальных пропорционально", () => {
    // Весь пул 21 000 уже был распределён по еде и кафе.
    const result = reallocateCategories({
      poolCents: toCents(21000),
      slotCount: 2,
      paySlotId: SALARY,
      categories: [food, cafe, lunches],
      stored: stored({ food: 15000, cafe: 6000 }),
    });

    const byId = new Map(result.allocations.map((a) => [a.categoryId, a.amountCents]));
    const total = [...byId.values()].reduce((sum, cents) => sum + cents, 0);

    expect(total).toBe(toCents(21000));
    expect(byId.get("lunch")).toBeGreaterThan(0);
    expect(byId.get("food")!).toBeLessThan(toCents(15000));
    expect(result.changes.map((c) => c.categoryId).sort()).toEqual(["cafe", "food", "lunch"]);
  });

  it("закреплённая за выплатой категория получает деньги первой", () => {
    const result = reallocateCategories({
      poolCents: toCents(30000),
      slotCount: 2,
      paySlotId: ADVANCE,
      categories: [rent, food, lunches],
      stored: new Map(),
    });

    const byId = new Map(result.allocations.map((a) => [a.categoryId, a.amountCents]));
    expect(byId.get("rent")).toBe(toCents(25000));
    expect(byId.get("food")! + byId.get("lunch")!).toBe(toCents(5000));
  });

  it("категория без лимита выпадает из раскладки", () => {
    const result = reallocateCategories({
      poolCents: toCents(100000),
      slotCount: 2,
      paySlotId: SALARY,
      categories: [food],
      stored: stored({ food: 15000, cafe: 6000 }),
    });

    expect(result.changes).toEqual([
      { categoryId: "cafe", beforeCents: toCents(6000), afterCents: 0 },
    ]);
  });

  it("самые большие изменения идут первыми", () => {
    const result = reallocateCategories({
      poolCents: toCents(100000),
      slotCount: 2,
      paySlotId: SALARY,
      categories: [food, cafe, lunches],
      stored: stored({ food: 14000, cafe: 6000 }),
    });

    expect(result.changes[0].categoryId).toBe("lunch");
    expect(result.changes[1].categoryId).toBe("food");
  });
});

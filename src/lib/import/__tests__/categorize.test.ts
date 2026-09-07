import { describe, expect, it } from "vitest";

import { applyRules, type CategoryRule } from "../categorize";

function rule(overrides: Partial<CategoryRule>): CategoryRule {
  return {
    id: "rule",
    matchType: "contains",
    pattern: "METRO TPP",
    categoryId: "transport",
    scope: null,
    priority: 0,
    ...overrides,
  };
}

const metroPending = {
  merchant: "*METRO TPP*SANKT-PETERBU*Russia",
  description: "Goods 06.09.2026 22:45 карта *9290",
};

describe("applyRules", () => {
  it("матчит правило по нормализованному мерчанту", () => {
    expect(applyRules([rule({})], metroPending)?.categoryId).toBe("transport");
  });

  it("матчит и до, и после проводки", () => {
    const settled = {
      merchant: "METRO TPP,SQ RASTRELLI 2 A, SANKT-PETERBU, RU",
      description: "Покупка товара НДС не облагается. . 04.09.2026 11:22 карта *9290",
    };

    expect(applyRules([rule({})], settled)?.categoryId).toBe("transport");
  });

  it("ищет и в описании операции", () => {
    const rules = [rule({ pattern: "выдача наличных", categoryId: "cash" })];
    const cash = { merchant: "VLADIMIRSKIY PR, 12", description: "Выдача наличных денежных средств" };

    expect(applyRules(rules, cash)?.categoryId).toBe("cash");
  });

  it("отдаёт правило с наибольшим приоритетом", () => {
    const rules = [
      rule({ id: "seed", categoryId: "transport", priority: 0 }),
      rule({ id: "manual", categoryId: "groceries", priority: 10 }),
    ];

    expect(applyRules(rules, metroPending)?.id).toBe("manual");
  });

  it("понимает регулярные выражения", () => {
    const rules = [rule({ matchType: "regex", pattern: "^METRO\\s", categoryId: "transport" })];

    expect(applyRules(rules, metroPending)?.categoryId).toBe("transport");
  });

  it("не роняет импорт из-за битой регулярки", () => {
    const rules = [rule({ matchType: "regex", pattern: "([" })];

    expect(applyRules(rules, metroPending)).toBeNull();
  });

  it("возвращает null, когда ничего не подошло", () => {
    const transfer = { merchant: "Артем Игоревич Н.", description: "СБП. Списание" };

    expect(applyRules([rule({})], transfer)).toBeNull();
  });
});

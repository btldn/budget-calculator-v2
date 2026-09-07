import { describe, expect, it } from "vitest";

import { groupUnknownRows, type UnknownRow } from "../group-unknown";

function row(overrides: Partial<UnknownRow>): UnknownRow {
  return {
    fingerprint: Math.random().toString(36).slice(2),
    kind: "expense",
    amount: "65.00",
    merchantKey: "METRO TPP",
    merchant: "*METRO TPP*SANKT-PETERBU*Russia",
    description: "Goods 06.09.2026 22:45 карта *9290",
    categoryId: null,
    ...overrides,
  };
}

describe("groupUnknownRows", () => {
  it("схлопывает операции одного источника в одну строку разметки", () => {
    const groups = groupUnknownRows([
      row({ fingerprint: "a" }),
      row({ fingerprint: "b", amount: "61.00" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "METRO TPP", count: 2, total: 126 });
    expect(groups[0].fingerprints).toEqual(["a", "b"]);
  });

  it("не трогает строки, которым правила уже дали категорию", () => {
    const groups = groupUnknownRows([
      row({ categoryId: "transport" }),
      row({ merchantKey: "SPAR 905" }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["SPAR 905"]);
  });

  it("разводит расход и доход одного мерчанта — у них разные категории", () => {
    const groups = groupUnknownRows([row({}), row({ kind: "income" })]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.kind).sort()).toEqual(["expense", "income"]);
  });

  it("берёт ключ из описания, если мерчанта в выписке нет", () => {
    const groups = groupUnknownRows([
      row({ merchantKey: "", merchant: "", description: "СБП. Списание" }),
    ]);

    expect(groups[0].key).toBe("СБП. СПИСАНИЕ");
    expect(groups[0].sample).toBe("СБП. Списание");
  });

  it("ставит наверх источники с наибольшим числом операций", () => {
    const groups = groupUnknownRows([
      row({ merchantKey: "SPAR 905" }),
      row({ merchantKey: "OOO BENUAR" }),
      row({ merchantKey: "OOO BENUAR" }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["OOO BENUAR", "SPAR 905"]);
  });
});

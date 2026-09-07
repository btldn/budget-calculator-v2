import { describe, expect, it } from "vitest";

import { fingerprintStatement } from "../fingerprint";
import { normalizeMerchant } from "../normalize";

describe("normalizeMerchant", () => {
  it.each([
    ["*METRO TPP*SANKT-PETERBU*Russia", "METRO TPP"],
    ["METRO TPP,SQ RASTRELLI 2 A, SANKT-PETERBU, RU", "METRO TPP"],
    ["*OOO BENUAR*SANKT-PETERBU*Russia", "OOO BENUAR"],
    ["OOO BENUAR,12 VLADIMIRSKIY, SANKT-PETERBU, RU", "OOO BENUAR"],
    ["VLADIMIRSKIY PR, 12*BSPB*St Petersburg*Russia", "VLADIMIRSKIY PR"],
    ["VLADIMIRSKIY PR, 12, St Petersburg, RU", "VLADIMIRSKIY PR"],
    ["  spar   905  ", "SPAR 905"],
    ["", ""],
  ])("«%s» → «%s»", (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected);
  });
});

describe("fingerprintStatement", () => {
  const pending = {
    occurredOn: "2026-09-06",
    time: "22:45",
    kind: "expense" as const,
    amount: "65.00",
    merchant: "*METRO TPP*SANKT-PETERBU*Russia",
  };
  const settled = { ...pending, merchant: "METRO TPP,SQ RASTRELLI 2 A, SANKT-PETERBU, RU" };

  it("узнаёт ту же операцию после проводки, несмотря на другое написание мерчанта", () => {
    const [first] = fingerprintStatement([pending]);
    const [second] = fingerprintStatement([settled]);

    expect(first).toBe(second);
  });

  it("разводит две одинаковые покупки за день — это разные траты", () => {
    const prints = fingerprintStatement([pending, { ...pending }]);

    expect(new Set(prints).size).toBe(2);
  });

  it("различает операции по времени и по сумме", () => {
    const prints = fingerprintStatement([
      pending,
      { ...pending, time: "11:37" },
      { ...pending, amount: "61.00" },
      { ...pending, kind: "income" },
    ]);

    expect(new Set(prints).size).toBe(4);
  });
});

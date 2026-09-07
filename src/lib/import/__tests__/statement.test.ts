import { describe, expect, it } from "vitest";

import { parseXlsxGrid } from "../parsers/xlsx";
import { mapStatementRows } from "../statement";
import {
  buildXlsx,
  NBSP,
  STATEMENT_HEADER,
  STATEMENT_PREAMBLE,
  type FixtureCell,
} from "./build-xlsx";

const TOTALS: FixtureCell[][] = [
  [null, null, null, null, null, "Поступление", `1${NBSP}000.00`],
  [null, null, null, null, null, "Списание", `-5${NBSP}065.00`],
];

const DATA: FixtureCell[][] = [
  [
    "06.09.2026",
    null,
    "*METRO TPP*SANKT-PETERBU*Russia",
    "Goods 06.09.2026 22:45 карта *9290",
    "В ожидании",
    "RUB",
    "-65.00",
  ],
  [
    "06.09.2026",
    null,
    "VLADIMIRSKIY PR, 12*BSPB*St Petersburg*Russia",
    "Cash 06.09.2026 16:14 карта *3092",
    "В ожидании",
    "RUB",
    `-5${NBSP}000.00`,
  ],
  [
    "05.09.2026",
    null,
    'ПАО "БАНК "САНКТ-ПЕТЕРБУРГ"',
    "СБП. Зачисление. Входящий перевод по СБП",
    "Успешно выполнена",
    "RUB",
    `1${NBSP}000.00`,
  ],
  [
    "04.09.2026",
    null,
    "SHOP,STR TEST 1, SANKT-PETERBU, RU",
    "Покупка товара 04.09.2026 11:22 карта *9290",
    "Успешно выполнена",
    "USD",
    "-10.00",
  ],
];

function parse(rows: FixtureCell[][]) {
  return mapStatementRows(parseXlsxGrid(buildXlsx(rows)));
}

describe("mapStatementRows", () => {
  const result = parse([...STATEMENT_PREAMBLE, STATEMENT_HEADER, ...DATA, ...TOTALS]);

  it("находит шапку под строками-заглушками и отсекает итоги", () => {
    expect(result.rows.map((row) => row.rowNumber)).toEqual([7, 8, 9]);
  });

  it("читает суммы с неразрывным пробелом и уводит знак в kind", () => {
    expect(result.rows.map((row) => [row.kind, row.amount])).toEqual([
      ["expense", "65.00"],
      ["expense", "5000.00"],
      ["income", "1000.00"],
    ]);
  });

  it("переводит дату в ISO", () => {
    expect(result.rows[0].occurredOn).toBe("2026-09-06");
  });

  it("достаёт время операции и номер карты из описания", () => {
    expect(result.rows[0]).toMatchObject({ time: "22:45", cardLast4: "9290" });
    expect(result.rows[1]).toMatchObject({ time: "16:14", cardLast4: "3092" });
    // У перевода по СБП нет ни отметки времени, ни карты.
    expect(result.rows[2]).toMatchObject({ time: null, cardLast4: null });
  });

  it("помечает непроведённые операции", () => {
    expect(result.rows.map((row) => row.pending)).toEqual([true, true, false]);
  });

  it("пропускает валюту, отличную от рубля, и говорит об этом", () => {
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("USD");
  });

  it("объясняет, что шапки нет", () => {
    expect(() => parse([["Что-то", "совсем", "другое"]])).toThrow(/шапку/);
  });

  it("объясняет, что операций не нашлось", () => {
    expect(() => parse([STATEMENT_HEADER, ...TOTALS])).toThrow(/ни одной операции/);
  });
});

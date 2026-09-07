import { describe, expect, it } from "vitest";

import { parseXlsxGrid } from "../parsers/xlsx";
import { buildXlsx, STATEMENT_HEADER, STATEMENT_PREAMBLE, toExcelSerial } from "./build-xlsx";

describe("parseXlsxGrid", () => {
  it("держит нумерацию колонок по ссылке ячейки, а не по порядку", () => {
    // Колонка B у банка пустая и приезжает самозакрывающимся <c r="B7"/>.
    const grid = parseXlsxGrid(
      buildXlsx([
        ...STATEMENT_PREAMBLE,
        STATEMENT_HEADER,
        ["06.09.2026", null, "SPAR 905", "Покупка", "Успешно выполнена", "RUB", "-250.80"],
      ]),
    );

    expect(grid[5]).toEqual(STATEMENT_HEADER);
    expect(grid[6][1]).toBe("");
    expect(grid[6][2]).toBe("SPAR 905");
    expect(grid[6][6]).toBe("-250.80");
  });

  it("сохраняет пустые строки на своих местах", () => {
    const grid = parseXlsxGrid(buildXlsx(STATEMENT_PREAMBLE));

    expect(grid).toHaveLength(5);
    expect(grid[1].every((cell) => cell === "")).toBe(true);
    expect(grid[2][0]).toBe("Период:");
  });

  it("превращает числовые даты в ISO", () => {
    const grid = parseXlsxGrid(
      buildXlsx([
        ["Дата", "Сумма"],
        [{ serialDate: toExcelSerial("2026-09-06") }, -65],
      ]),
    );

    expect(grid[1][0]).toBe("2026-09-06");
    expect(grid[1][1]).toBe("-65");
  });

  it("разэкранирует сущности в тексте", () => {
    const grid = parseXlsxGrid(buildXlsx([['ПАО "БАНК" & Ко']]));

    expect(grid[0][0]).toBe('ПАО "БАНК" & Ко');
  });

  it("объясняет, что файл не читается", () => {
    expect(() => parseXlsxGrid(new Uint8Array([1, 2, 3]))).toThrow(/не .xlsx|повреждён/);
  });
});

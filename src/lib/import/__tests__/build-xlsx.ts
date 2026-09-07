import { strToU8, zipSync } from "fflate";

/**
 * Собирает .xlsx для тестов. Настоящую выписку в репозиторий не кладём — в ней
 * ФИО третьих лиц и коды операций, поэтому структуру файла воспроизводим кодом:
 * пустые ячейки самозакрывающимися тегами, текст через sharedStrings, даты —
 * либо строкой, либо числом со стилем даты.
 */
export type FixtureCell = string | number | null | { serialDate: number };

const DATE_STYLE = 1;

function columnLetter(index: number): string {
  let letter = "";
  let rest = index;
  do {
    letter = String.fromCharCode(65 + (rest % 26)) + letter;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);
  return letter;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Excel считает дни от 1899-12-30. */
export function toExcelSerial(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000 + 25569;
}

export function buildXlsx(rows: FixtureCell[][]): Uint8Array {
  const sharedStrings: string[] = [];
  const indexOfString = new Map<string, number>();

  function sharedIndex(value: string): number {
    const known = indexOfString.get(value);
    if (known !== undefined) return known;
    const index = sharedStrings.length;
    sharedStrings.push(value);
    indexOfString.set(value, index);
    return index;
  }

  const sheetRows = rows.map((cells, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const body = cells
      .map((cell, columnIndex) => {
        const ref = `${columnLetter(columnIndex)}${rowNumber}`;

        if (cell === null || cell === "") return `<c r="${ref}" s="0"/>`;
        if (typeof cell === "number") return `<c r="${ref}" s="0"><v>${cell}</v></c>`;
        if (typeof cell === "object") {
          return `<c r="${ref}" s="${DATE_STYLE}"><v>${cell.serialDate}</v></c>`;
        }
        return `<c r="${ref}" s="0" t="s"><v>${sharedIndex(cell)}</v></c>`;
      })
      .join("");

    return `<row r="${rowNumber}" spans="1:${cells.length}">${body}</row>`;
  });

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="История операций" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    ),
    "xl/sharedStrings.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${sharedStrings
        .map((value) => `<si><t xml:space="preserve">${escapeXml(value)}</t></si>`)
        .join("")}</sst>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows.join("")}</sheetData></worksheet>`,
    ),
  };

  return zipSync(files);
}

/** Неразрывный пробел (U+00A0) — им банк разделяет разряды в суммах. */
export const NBSP = String.fromCharCode(160);

/** Шапка выписки Банка «Санкт-Петербург». */
export const STATEMENT_HEADER: FixtureCell[] = [
  "Дата",
  "Счёт плательщика / получателя",
  "Плательщик / Получатель",
  "Операция",
  "Статус операции",
  "Валюта",
  "Сумма",
];

/** Пять строк-заглушек над шапкой, как в настоящей выгрузке. */
export const STATEMENT_PREAMBLE: FixtureCell[][] = [
  ["История операций", null, null, null, null, null, null],
  [null, null, null, null, null, null, null],
  ["Период:", null, "01.09.2026 - 07.09.2026", null, null, null, null],
  ["Тип операций:", null, "Все операции", null, null, null, null],
  ["Счета/карты:", null, "Все счета", null, null, null, null],
];

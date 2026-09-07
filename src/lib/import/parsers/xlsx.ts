import { strFromU8, unzipSync } from "fflate";

/** Сетка листа: grid[номер строки - 1][номер колонки - 1] → текст ячейки. */
export type XlsxGrid = string[][];

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Форматы дат, зашитые в OOXML (ECMA-376, 18.8.30). */
const BUILTIN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58,
]);

/** Дней между эпохой Excel (1899-12-30) и эпохой Unix. */
const EXCEL_EPOCH_OFFSET = 25569;

const ATTRIBUTE_RE = /([\w:.-]+)="([^"]*)"/g;

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return XML_ENTITIES[entity] ?? match;
  });
}

type Attributes = Map<string, string>;

function parseAttributes(source: string): Attributes {
  const attributes: Attributes = new Map();
  ATTRIBUTE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE_RE.exec(source)) !== null) {
    attributes.set(match[1], decodeXml(match[2]));
  }
  return attributes;
}

type Element = { attributes: Attributes; inner: string };

/**
 * Проходит по элементам `name`, отдавая атрибуты и содержимое.
 * Самозакрывающиеся теги (`<c r="B7" s="2"/>`) отдаются с пустым содержимым —
 * без этого разбор съезжает на колонку вправо.
 */
function* elements(xml: string, name: string): Generator<Element> {
  const open = new RegExp(`<${name}(\\s[^>]*?)?(/?)>`, "g");
  let match: RegExpExecArray | null;

  while ((match = open.exec(xml)) !== null) {
    const attributes = parseAttributes(match[1] ?? "");

    if (match[2] === "/") {
      yield { attributes, inner: "" };
      continue;
    }

    const close = xml.indexOf(`</${name}>`, open.lastIndex);
    if (close === -1) return;

    yield { attributes, inner: xml.slice(open.lastIndex, close) };
    open.lastIndex = close + name.length + 3;
  }
}

/** Собирает текст из всех `<t>` — у форматированной строки их несколько. */
function textOf(xml: string): string {
  let text = "";
  for (const { inner } of elements(xml, "t")) text += inner;
  return decodeXml(text);
}

/** "B7" → 1, "AA12" → 26 */
function columnIndex(ref: string): number {
  let index = 0;
  for (const char of ref) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

function serialToIsoDate(serial: number): string {
  const date = new Date(Math.round((serial - EXCEL_EPOCH_OFFSET) * 86_400_000));
  return Number.isNaN(date.getTime()) ? String(serial) : date.toISOString().slice(0, 10);
}

function readSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...elements(xml, "si")].map(({ inner }) => textOf(inner));
}

/** Индексы стилей (`s="4"`), которые означают дату. */
function readDateStyles(xml: string | undefined): Set<number> {
  if (!xml) return new Set();

  const dateFormatIds = new Set(BUILTIN_DATE_FORMATS);
  for (const { attributes } of elements(xml, "numFmt")) {
    const id = Number(attributes.get("numFmtId"));
    // Литералы в маске тоже содержат буквы — отбрасываем их перед проверкой.
    const bare = (attributes.get("formatCode") ?? "").replace(/"[^"]*"|\[[^\]]*\]/g, "");
    if (Number.isFinite(id) && /[dmyhs]/i.test(bare)) dateFormatIds.add(id);
  }

  const [cellXfs] = [...elements(xml, "cellXfs")];
  if (!cellXfs) return new Set();

  const styles = new Set<number>();
  let index = 0;
  for (const { attributes } of elements(cellXfs.inner, "xf")) {
    if (dateFormatIds.has(Number(attributes.get("numFmtId")))) styles.add(index);
    index += 1;
  }
  return styles;
}

function findSheetPath(files: Record<string, Uint8Array>): string {
  const workbook = files["xl/workbook.xml"];
  const rels = files["xl/_rels/workbook.xml.rels"];

  if (workbook && rels) {
    const [first] = [...elements(strFromU8(workbook), "sheet")];
    const relId = first?.attributes.get("r:id");

    if (relId) {
      for (const { attributes } of elements(strFromU8(rels), "Relationship")) {
        if (attributes.get("Id") !== relId) continue;
        const target = attributes.get("Target") ?? "";
        const path = target.startsWith("/")
          ? target.slice(1)
          : `xl/${target.replace(/^\.\//, "")}`;
        if (files[path]) return path;
      }
    }
  }

  const [fallback] = Object.keys(files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort();
  if (!fallback) {
    throw new Error("В файле не найден ни один лист.");
  }
  return fallback;
}

function cellValue(
  attributes: Attributes,
  inner: string,
  shared: string[],
  dateStyles: Set<number>,
): string {
  const type = attributes.get("t") ?? "n";

  if (type === "inlineStr") return textOf(inner).trim();

  const [raw] = [...elements(inner, "v")];
  if (!raw) return "";
  const value = decodeXml(raw.inner).trim();

  if (type === "s") return shared[Number(value)] ?? "";
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  if (type === "str" || type === "e") return value;

  const style = Number(attributes.get("s"));
  const numeric = Number(value);
  if (Number.isFinite(style) && dateStyles.has(style) && Number.isFinite(numeric)) {
    return serialToIsoDate(numeric);
  }
  return value;
}

function readSheet(xml: string, shared: string[], dateStyles: Set<number>): XlsxGrid {
  const grid: XlsxGrid = [];
  let previousRow = 0;

  for (const row of elements(xml, "row")) {
    const rowNumber = Number(row.attributes.get("r")) || previousRow + 1;
    previousRow = rowNumber;

    const cells: string[] = [];
    let previousColumn = -1;

    for (const cell of elements(row.inner, "c")) {
      const ref = cell.attributes.get("r");
      const column = ref ? columnIndex(ref) : previousColumn + 1;
      previousColumn = column;

      cells[column] = cellValue(cell.attributes, cell.inner, shared, dateStyles);
    }

    for (let i = 0; i < cells.length; i += 1) cells[i] ??= "";
    grid[rowNumber - 1] = cells;
  }

  for (let i = 0; i < grid.length; i += 1) grid[i] ??= [];
  return grid;
}

/**
 * Читает первый лист .xlsx в сетку строк. Ничего не знает о банках и форматах
 * выписок — это дело `mapStatementRows`.
 */
export function parseXlsxGrid(buffer: ArrayBuffer | Uint8Array): XlsxGrid {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("Не удалось прочитать файл — он повреждён или это не .xlsx.");
  }

  const sharedStrings = files["xl/sharedStrings.xml"];
  const styles = files["xl/styles.xml"];

  return readSheet(
    strFromU8(files[findSheetPath(files)]),
    readSharedStrings(sharedStrings && strFromU8(sharedStrings)),
    readDateStyles(styles && strFromU8(styles)),
  );
}

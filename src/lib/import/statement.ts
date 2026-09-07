import type { XlsxGrid } from "./parsers/xlsx";

export type ParsedRow = {
  /** Номер строки на листе — чтобы человек нашёл её в исходном файле. */
  rowNumber: number;
  occurredOn: string;
  /** `HH:mm` из описания, если банк его прислал — разводит одинаковые покупки за день. */
  time: string | null;
  kind: "expense" | "income";
  /** Всегда положительная, знак уехал в `kind`. */
  amount: string;
  merchant: string;
  description: string;
  status: string;
  pending: boolean;
  currency: string;
  cardLast4: string | null;
};

export type StatementParseResult = {
  rows: ParsedRow[];
  warnings: string[];
};

type Field = "date" | "merchant" | "description" | "status" | "currency" | "amount";

const COLUMN_ALIASES: Record<Field, string[]> = {
  date: ["дата", "дата операции", "дата и время", "date"],
  merchant: [
    "плательщик / получатель",
    "плательщик/получатель",
    "получатель",
    "контрагент",
    "место совершения",
  ],
  description: ["операция", "описание", "назначение платежа", "детали операции"],
  status: ["статус операции", "статус"],
  currency: ["валюта", "валюта операции"],
  amount: ["сумма", "сумма операции", "сумма в валюте счёта", "сумма в валюте счета"],
};

const REQUIRED_FIELDS: Field[] = ["date", "amount"];

/** Разряды банк разделяет неразрывным пробелом — `\s` в JS ловит и его. */
const SPACES_RE = /\s/g;

function normalizeHeader(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/:$/, "").toLowerCase();
}

function findColumns(header: string[]): Partial<Record<Field, number>> {
  const columns: Partial<Record<Field, number>> = {};

  header.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;

    for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [Field, string[]][]) {
      if (columns[field] === undefined && aliases.includes(normalized)) {
        columns[field] = index;
      }
    }
  });

  return columns;
}

function findHeaderRow(grid: XlsxGrid): number {
  return grid.findIndex((row) => {
    const columns = findColumns(row);
    return columns.date !== undefined && columns.amount !== undefined;
  });
}

/** `06.09.2026` или уже готовый ISO (парсер отдаёт его для числовых дат). */
function parseDate(value: string): string | null {
  const trimmed = value.trim();

  const dotted = /^(\d{2})[.\-/](\d{2})[.\-/](\d{4})/.exec(trimmed);
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return iso[0];

  return null;
}

function parseAmount(value: string): number | null {
  let text = value.replace(SPACES_RE, "");
  if (!text) return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  // «1,234.56» — запятая разделяет разряды; «1234,56» — она же десятичная.
  text = hasComma && hasDot ? text.replace(/,/g, "") : text.replace(",", ".");
  text = text.replace(/[^\d.\-+]/g, "");

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** «Goods 06.09.2026 23:16 карта *9290» → `23:16`. */
function parseOperationTime(description: string): string | null {
  const match = /\d{2}\.\d{2}\.\d{4}\s+(\d{2}:\d{2})/.exec(description);
  return match ? match[1] : null;
}

function parseCardLast4(description: string): string | null {
  const match = /карта\s*\*?\s*(\d{4})/i.exec(description) ?? /\*(\d{4})\b/.exec(description);
  return match ? match[1] : null;
}

function cell(row: string[], index: number | undefined): string {
  return index === undefined ? "" : (row[index] ?? "").trim();
}

/**
 * Превращает сетку листа в операции. Шапка ищется по заголовкам, поэтому
 * лишние строки сверху (период, тип операций) и итоги снизу отсекаются сами.
 */
export function mapStatementRows(grid: XlsxGrid): StatementParseResult {
  const headerIndex = findHeaderRow(grid);
  if (headerIndex === -1) {
    throw new Error(
      "Не нашёл шапку таблицы: нужны колонки «Дата» и «Сумма». Проверьте, что это выписка по счёту.",
    );
  }

  const columns = findColumns(grid[headerIndex]);
  const missing = REQUIRED_FIELDS.filter((field) => columns[field] === undefined);
  if (missing.length > 0) {
    throw new Error("В выписке не хватает обязательных колонок «Дата» и «Сумма».");
  }
  if (columns.merchant === undefined && columns.description === undefined) {
    throw new Error("В выписке нет ни описания операции, ни получателя — категоризировать нечего.");
  }

  const rows: ParsedRow[] = [];
  const warnings: string[] = [];

  for (let index = headerIndex + 1; index < grid.length; index += 1) {
    const row = grid[index];
    const rowNumber = index + 1;

    if (row.every((value) => !value.trim())) continue;

    const occurredOn = parseDate(cell(row, columns.date));
    // Ниже данных идут итоги — у них нет даты, значит таблица кончилась.
    if (!occurredOn) break;

    const currency = cell(row, columns.currency);
    if (currency && currency.toUpperCase() !== "RUB") {
      warnings.push(`Строка ${rowNumber}: валюта ${currency} не поддерживается, строка пропущена.`);
      continue;
    }

    const amount = parseAmount(cell(row, columns.amount));
    if (amount === null || amount === 0) {
      warnings.push(`Строка ${rowNumber}: не понял сумму «${cell(row, columns.amount)}».`);
      continue;
    }

    const description = cell(row, columns.description);
    const status = cell(row, columns.status);

    rows.push({
      rowNumber,
      occurredOn,
      time: parseOperationTime(description),
      kind: amount < 0 ? "expense" : "income",
      amount: Math.abs(amount).toFixed(2),
      merchant: cell(row, columns.merchant),
      description,
      status,
      pending: /ожидан/i.test(status),
      currency: currency || "RUB",
      cardLast4: parseCardLast4(description),
    });
  }

  if (rows.length === 0) {
    throw new Error("В файле не нашлось ни одной операции.");
  }

  return { rows, warnings };
}

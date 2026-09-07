import type { ParsedRow } from "./statement";

/**
 * Угадывает способ оплаты по тексту операции. Возвращает имя, а не id —
 * сопоставление с таблицей `payment_methods` делает вызывающий код.
 */
export function guessPaymentMethodName(row: ParsedRow): string | null {
  const text = `${row.description} ${row.merchant}`;

  if (/\bcash\b|выдача наличных|банкомат/i.test(text)) return "Наличные";
  if (/\bсбп\b|перевод/i.test(text)) return "Перевод";
  if (row.cardLast4) return "Карта";

  return null;
}

import { createHash } from "node:crypto";

import { normalizeMerchant } from "./normalize";

export type FingerprintInput = {
  occurredOn: string;
  time: string | null;
  kind: "expense" | "income";
  amount: string;
  merchant: string;
};

/**
 * Описание в ключ намеренно не входит: одна и та же покупка приезжает сперва
 * как «Goods 06.09.2026 23:16 карта *9290», а после проводки — как «Покупка
 * товара НДС не облагается…». По дате, времени, сумме и нормализованному
 * мерчанту они совпадут, и повторный импорт будет пойман.
 */
function baseKey(input: FingerprintInput): string {
  return [
    input.occurredOn,
    input.time ?? "",
    input.kind,
    input.amount,
    normalizeMerchant(input.merchant),
  ].join("|");
}

export function transactionFingerprint(input: FingerprintInput, occurrence = 0): string {
  const key = occurrence > 0 ? `${baseKey(input)}#${occurrence}` : baseKey(input);
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * Отпечатки для всей выписки разом. Две одинаковые операции за один день
 * (например, два прохода в метро по 65 ₽) — это разные траты, поэтому они
 * разводятся порядковым номером: иначе уникальный индекс в БД отвергнет вторую.
 */
export function fingerprintStatement(rows: FingerprintInput[]): string[] {
  const seen = new Map<string, number>();

  return rows.map((row) => {
    const key = baseKey(row);
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return transactionFingerprint(row, occurrence);
  });
}

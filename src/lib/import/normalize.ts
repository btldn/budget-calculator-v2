/**
 * Сводит написания одного мерчанта к общему ключу.
 *
 * Банк присылает непроведённую операцию как `*METRO TPP*SANKT-PETERBU*Russia`,
 * а её же после проводки — как `METRO TPP,SQ RASTRELLI 2 A, SANKT-PETERBU, RU`.
 * Без этого шага правила не сработают, а дубли не отловятся.
 */
export function normalizeMerchant(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const starred = /^\*([^*]+)\*/.exec(trimmed);
  const head = starred ? starred[1] : trimmed.split(",")[0];

  return head.replace(/\s+/g, " ").trim().toUpperCase();
}

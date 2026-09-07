// Client-safe date helpers. Money/locale formatting that depends on
// APP_CURRENCY/APP_LOCALE lives in "@/lib/format" (server-only) — those env
// vars aren't exposed to the browser, so client components can't read them.

export function todayIsoClient(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

export type MoneyFormat = { currency: string; locale: string };

/** Форматирует деньги на клиенте по настройкам, переданным с сервера. */
export function makeMoneyFormatter({ currency, locale }: MoneyFormat) {
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return (amount: number | string) =>
    `${formatter.format(typeof amount === "string" ? Number(amount) : amount)} ${currency}`;
}

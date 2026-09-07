import "server-only";

import type { MoneyFormat } from "@/lib/format-client";

const CURRENCY = process.env.APP_CURRENCY || "€";
const LOCALE = process.env.APP_LOCALE || "ru-RU";

const numberFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number | string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return `${numberFormatter.format(value)} ${CURRENCY}`;
}

export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

/** Валюта и локаль для клиентских компонентов — env-переменные в браузер не уезжают. */
export function moneyFormat(): MoneyFormat {
  return { currency: CURRENCY, locale: LOCALE };
}

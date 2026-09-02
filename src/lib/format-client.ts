// Client-safe date helpers. Money/locale formatting that depends on
// APP_CURRENCY/APP_LOCALE lives in "@/lib/format" (server-only) — those env
// vars aren't exposed to the browser, so client components can't read them.

export function todayIsoClient(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

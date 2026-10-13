// Даты выплат из графика. Все даты — локальные «чистые» (полночь), без часовых
// поясов: выплата привязана к календарному дню, а не к моменту времени.

export type PaySlotDay = { id: string; dayOfMonth: number };

export type Payday<T extends PaySlotDay> = { slot: T; date: Date };

export type LastPaycheck = { receivedOn: string; payScheduleId: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// 31-е в феврале (и 30–31-е в коротких месяцах) превращается в последний день
// месяца — выплата «31 числа» приходит в конце любого месяца.
export function paydayDate(year: number, monthIndex: number, dayOfMonth: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dayOfMonth, lastDay));
}

// Все даты выплат в месяцах от monthOffsets относительно месяца `around`.
function occurrences<T extends PaySlotDay>(
  slots: T[],
  around: Date,
  monthOffsets: number[],
): Payday<T>[] {
  return monthOffsets.flatMap((offset) =>
    slots.map((slot) => ({
      slot,
      date: paydayDate(around.getFullYear(), around.getMonth() + offset, slot.dayOfMonth),
    })),
  );
}

// Ближайшая выплата строго после `after`: сегодняшняя уже «прошла» —
// деньги с неё либо внесены, либо пора их внести.
export function nextPayday<T extends PaySlotDay>(slots: T[], after: Date): Payday<T> | null {
  const day = startOfDay(after);
  const upcoming = occurrences(slots, day, [0, 1]).filter(
    (payday) => payday.date.getTime() > day.getTime(),
  );
  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
  return upcoming[0] ?? null;
}

// Последняя выплата по графику не позже `onOrBefore`.
export function latestPayday<T extends PaySlotDay>(
  slots: T[],
  onOrBefore: Date,
): Payday<T> | null {
  const day = startOfDay(onOrBefore);
  const past = occurrences(slots, day, [-1, 0]).filter(
    (payday) => payday.date.getTime() <= day.getTime(),
  );
  past.sort((a, b) => b.date.getTime() - a.date.getTime());
  return past[0] ?? null;
}

// К какой «плановой» дате относится фактически внесённая выплата: зарплату
// «за 25-е» могут внести 24-го или 27-го, но это всё та же выплата.
// Берём ближайшее к фактической дате вхождение этой выплаты в графике.
export function nominalPayday(slot: PaySlotDay | undefined, receivedOn: string): Date {
  const received = parseIsoDate(receivedOn);
  if (!slot) return received;

  const candidates = occurrences([slot], received, [-1, 0, 1]).map((payday) => payday.date);
  return candidates.reduce((best, date) =>
    Math.abs(date.getTime() - received.getTime()) < Math.abs(best.getTime() - received.getTime())
      ? date
      : best,
  );
}

// Ближайшая выплата после внесённой. Считается от плановой даты внесённой, а не
// от фактической: зарплату «за 25-е», внесённую 24-го, не должно считать 25-е
// следующим днём выплаты.
export function nextPaydayAfter<T extends PaySlotDay>(
  slots: T[],
  slot: PaySlotDay | undefined,
  receivedOn: string,
): Payday<T> | null {
  const received = parseIsoDate(receivedOn);
  const nominal = nominalPayday(slot, receivedOn);
  return nextPayday(slots, nominal > received ? nominal : received);
}

export type PendingPayday<T extends PaySlotDay> = Payday<T> & {
  // true — плановая выплата уже наступила, а в приложении её ещё нет.
  due: boolean;
};

// Какая выплата ждёт внесения: наступившая и не внесённая (due) либо ближайшая
// будущая. Нужна и для подсветки кнопки «Пришла зарплата», и чтобы подставить
// выплату в диалог по умолчанию.
export function pendingPayday<T extends PaySlotDay>(
  slots: T[],
  lastRegular: LastPaycheck | null,
  today: Date,
): PendingPayday<T> | null {
  const latest = latestPayday(slots, today);
  if (latest) {
    const lastNominal = lastRegular
      ? nominalPayday(
          slots.find((slot) => slot.id === lastRegular.payScheduleId),
          lastRegular.receivedOn,
        )
      : null;
    if (!lastNominal || lastNominal.getTime() < latest.date.getTime()) {
      return { ...latest, due: true };
    }
  }

  const upcoming = nextPayday(slots, today);
  return upcoming ? { ...upcoming, due: false } : null;
}

export function isPaydayDue<T extends PaySlotDay>(
  slots: T[],
  lastRegular: LastPaycheck | null,
  today: Date,
): boolean {
  return pendingPayday(slots, lastRegular, today)?.due ?? false;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

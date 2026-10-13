import { distributePaycheck, type DistributeCategory } from "./distribute";

export type AllocationChange = {
  categoryId: string;
  beforeCents: number;
  afterCents: number;
};

export type Reallocation = {
  // Новая раскладка: категории, получившие деньги.
  allocations: { categoryId: string; amountCents: number }[];
  // Что изменилось относительно сохранённой; пусто — раскладка актуальна.
  changes: AllocationChange[];
};

// Заново делит между категориями деньги выплаты, оставшиеся после целей и
// запаса. Цели и запас не пересчитываются: человек уже подтвердил их при
// внесении выплаты, а часть денег давно отложена.
export function reallocateCategories({
  poolCents,
  slotCount,
  paySlotId,
  categories,
  stored,
}: {
  // Сколько выплаты отдано на категории: сумма минус цели минус запас.
  poolCents: number;
  slotCount: number;
  paySlotId: string | null;
  categories: DistributeCategory[];
  // Сохранённая раскладка выплаты: категория → копейки.
  stored: Map<string, number>;
}): Reallocation {
  const result = distributePaycheck({
    amountCents: Math.max(0, poolCents),
    isExtra: false,
    slotCount,
    paySlotId,
    categories,
    goals: [],
    reserveMonthlyCents: 0,
    reservePerPaymentCents: 0,
  });

  const next = new Map(
    result.categories.filter((c) => c.amountCents > 0).map((c) => [c.categoryId, c.amountCents]),
  );

  const ids = new Set([...stored.keys(), ...next.keys()]);
  const changes: AllocationChange[] = [];
  for (const categoryId of ids) {
    const beforeCents = stored.get(categoryId) ?? 0;
    const afterCents = next.get(categoryId) ?? 0;
    if (beforeCents !== afterCents) changes.push({ categoryId, beforeCents, afterCents });
  }

  // Самые заметные изменения — сверху.
  changes.sort(
    (a, b) => Math.abs(b.afterCents - b.beforeCents) - Math.abs(a.afterCents - a.beforeCents),
  );

  return {
    allocations: [...next].map(([categoryId, amountCents]) => ({ categoryId, amountCents })),
    changes,
  };
}

type WithLimit = { monthlyLimit: string | null };

export const hasLimit = (category: WithLimit) => category.monthlyLimit !== null;

// Для устойчивой сортировки: категории с лимитом выше остальных, а внутри
// каждой группы остаётся порядок, заданный перетаскиванием.
export const limitedFirst = (a: WithLimit, b: WithLimit) =>
  Number(hasLimit(b)) - Number(hasLimit(a));

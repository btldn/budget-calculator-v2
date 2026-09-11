"use server";

import { getCategoryTransactionsPreview } from "@/lib/queries/transactions";

// Тонкая обёртка над серверным запросом (он помечен server-only и не
// вызывается напрямую с клиента) — для разворачиваемой панели категории
// на дашборде.
export async function fetchCategoryTransactionsPreview(
  categoryId: string,
  month: string,
  paidByUserId: string | null,
) {
  return getCategoryTransactionsPreview(categoryId, month, paidByUserId);
}

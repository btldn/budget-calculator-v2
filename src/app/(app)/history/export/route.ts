import { NextRequest } from "next/server";

import { getHistoryRowsForExport, type HistoryFilters } from "@/lib/queries/transactions";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const category = sp.get("category");

  const filters: HistoryFilters = {
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    categoryIds: category ? category.split(",").filter(Boolean) : undefined,
    paidByUserId: sp.get("paidBy") ?? undefined,
    scope: (sp.get("scope") as HistoryFilters["scope"]) ?? undefined,
    paymentMethodId: sp.get("method") ?? undefined,
    search: sp.get("q") ?? undefined,
    sort: (sp.get("sort") as HistoryFilters["sort"]) ?? "date",
    order: (sp.get("order") as HistoryFilters["order"]) ?? "desc",
  };

  const rows = await getHistoryRowsForExport(filters);

  const header = [
    "Дата",
    "Тип",
    "Сумма",
    "Категория",
    "Кто платил",
    "Чьё",
    "Способ",
    "Комментарий",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.occurredOn,
        row.kind === "expense" ? "Расход" : "Доход",
        row.amount,
        csvEscape(row.categoryName),
        csvEscape(row.paidByName),
        row.scope === "shared" ? "Общее" : "Личное",
        csvEscape(row.paymentMethodName ?? ""),
        csvEscape(row.note ?? ""),
      ].join(","),
    );
  }

  const csv = "﻿" + lines.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="history.csv"`,
    },
  });
}

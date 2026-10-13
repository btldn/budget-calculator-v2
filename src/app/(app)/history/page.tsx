import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, DownloadIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HistoryFilters } from "@/components/history-filters";
import { PeriodTotals } from "@/components/period-totals";
import { TransactionRowActions } from "@/components/transaction-row-actions";
import { getAllUsers } from "@/lib/current-user";
import { formatDate, formatMoney } from "@/lib/format";
import { getAllCategories, getAllPaymentMethods } from "@/lib/queries/categories";
import { getHistoryRows, type HistoryFilters as Filters } from "@/lib/queries/transactions";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(sp: SearchParams): Filters {
  const category = first(sp.category);
  return {
    from: first(sp.from),
    to: first(sp.to),
    categoryIds: category ? category.split(",").filter(Boolean) : undefined,
    paidByUserId: first(sp.paidBy),
    scope: first(sp.scope) as Filters["scope"],
    paymentMethodId: first(sp.method),
    search: first(sp.q),
    sort: (first(sp.sort) as Filters["sort"]) ?? "date",
    order: (first(sp.order) as Filters["order"]) ?? "desc",
  };
}

function buildQueryString(sp: SearchParams, overrides: Record<string, string | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = first(value);
    if (v) params.set(key, v);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  return params.toString();
}

function buildHref(sp: SearchParams, overrides: Record<string, string | null>) {
  return `/history?${buildQueryString(sp, overrides)}`;
}

function sortHeaderHref(sp: SearchParams, column: "date" | "amount") {
  const currentSort = first(sp.sort) ?? "date";
  const currentOrder = first(sp.order) ?? "desc";
  const nextOrder =
    currentSort === column && currentOrder === "desc" ? "asc" : "desc";
  return buildHref(sp, { sort: column, order: nextOrder, page: null });
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const [{ rows, pageCount, expenseTotal, incomeTotal }, categories, users, paymentMethods] =
    await Promise.all([
      getHistoryRows(filters, page),
      getAllCategories(),
      getAllUsers(),
      getAllPaymentMethods(),
    ]);

  const exportHref = `/history/export?${buildQueryString(sp, { page: null })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">История</h1>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={exportHref} />}
        >
          <DownloadIcon />
          Экспорт CSV
        </Button>
      </div>

      <PeriodTotals income={Number(incomeTotal)} expense={Number(expenseTotal)} />

      <HistoryFilters
        categories={categories}
        users={users}
        paymentMethods={paymentMethods}
      />

      {rows.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          По этому фильтру ничего не найдено.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Link href={sortHeaderHref(sp, "date")} className="flex items-center gap-1">
                    Дата
                    {filters.sort === "date" &&
                      (filters.order === "asc" ? (
                        <ArrowUpIcon className="size-3" />
                      ) : (
                        <ArrowDownIcon className="size-3" />
                      ))}
                  </Link>
                </TableHead>
                <TableHead>Категория</TableHead>
                <TableHead className="hidden sm:table-cell">Комментарий</TableHead>
                <TableHead className="hidden sm:table-cell">Кто платил</TableHead>
                <TableHead className="hidden sm:table-cell">Чьё</TableHead>
                <TableHead className="hidden sm:table-cell">Способ</TableHead>
                <TableHead className="text-right">
                  <Link
                    href={sortHeaderHref(sp, "amount")}
                    className="flex items-center justify-end gap-1"
                  >
                    Сумма
                    {filters.sort === "amount" &&
                      (filters.order === "asc" ? (
                        <ArrowUpIcon className="size-3" />
                      ) : (
                        <ArrowDownIcon className="size-3" />
                      ))}
                  </Link>
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDate(row.occurredOn)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.categoryColor }}
                      />
                      {row.categoryName}
                    </span>
                  </TableCell>
                  <TableCell className="hidden max-w-48 truncate text-muted-foreground sm:table-cell">
                    {row.note}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{row.paidByName}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline">
                      {row.scope === "shared" ? "Общее" : "Личное"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {row.paymentMethodName ?? "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      row.kind === "income" ? "text-[oklch(0.6_0.15_150)]" : ""
                    }`}
                  >
                    {row.kind === "income" ? "+" : "−"}
                    {formatMoney(row.amount)}
                  </TableCell>
                  <TableCell>
                    <TransactionRowActions transaction={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            nativeButton={false}
            render={<Link href={buildHref(sp, { page: String(page - 1) })} />}
          >
            Назад
          </Button>
          <span className="text-muted-foreground">
            стр. {page} из {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            nativeButton={false}
            render={<Link href={buildHref(sp, { page: String(page + 1) })} />}
          >
            Вперёд
          </Button>
        </div>
      )}
    </div>
  );
}

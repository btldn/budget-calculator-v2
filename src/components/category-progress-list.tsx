"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchCategoryTransactionsPreview } from "@/app/actions/dashboard";
import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { getCategoryEmoji } from "@/lib/category-emoji";
import {
  formatShortDate,
  makeMoneyFormatter,
  type MoneyFormat,
} from "@/lib/format-client";
import type { CategoryProgress } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

type PreviewRow = {
  id: string;
  occurredOn: string;
  kind: "expense" | "income";
  amount: string;
  note: string | null;
  categoryName: string;
  categoryColor: string;
  paidByName: string;
};

function monthBounds(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

// Список последних операций категории. Монтируется заново при каждом
// разворачивании и переспрашивает сервер, если после этого поменялась сумма
// по категории (spentKey) — иначе после добавления/правки/удаления операции
// список в открытой панели молча остался бы прежним.
function CategoryPreviewPanel({
  categoryId,
  month,
  paidByUserId,
  spentKey,
  historyHref,
  formatMoney,
}: {
  categoryId: string;
  month: string;
  paidByUserId: string | null;
  spentKey: string;
  historyHref: string;
  formatMoney: (amount: number | string) => string;
}) {
  // Ключ текущего запроса — категория, месяц, фильтр по человеку и сумма
  // категории (spentKey меняется на любую мутацию операций в ней). Пока
  // результат в state получен для другого ключа, панель считается
  // загружающейся — без отдельного синхронного setState в эффекте.
  const requestKey = `${categoryId}:${month}:${paidByUserId ?? ""}:${spentKey}`;
  const [state, setState] = useState<{ forKey: string; rows: PreviewRow[] | null }>({
    forKey: "",
    rows: null,
  });
  const isLoading = state.forKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    fetchCategoryTransactionsPreview(categoryId, month, paidByUserId).then((rows) => {
      if (!cancelled) setState({ forKey: requestKey, rows });
    });
    return () => {
      cancelled = true;
    };
  }, [categoryId, month, paidByUserId, requestKey]);

  return (
    <div className="mt-1 ml-5 space-y-1 border-l border-border pl-3">
      {isLoading ? (
        <p className="py-2 text-[13px] text-muted-foreground">Загрузка…</p>
      ) : state.rows && state.rows.length > 0 ? (
        <div className="divide-y divide-border">
          {state.rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2.5 py-2 text-sm">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-sm"
                style={{
                  backgroundColor: `color-mix(in srgb, ${row.categoryColor} 22%, white)`,
                }}
              >
                {getCategoryEmoji(row.categoryName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {row.note || row.categoryName}
                </span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {row.paidByName} · {formatShortDate(row.occurredOn)}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 tabular-nums text-[13px]",
                  row.kind === "income" ? "text-positive" : "text-foreground",
                )}
              >
                {row.kind === "income" ? "+" : "−"}
                {formatMoney(row.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-2 text-[13px] text-muted-foreground">Операций пока нет.</p>
      )}
      <Link
        href={historyHref}
        className="inline-block py-1.5 text-[13px] font-medium text-foreground underline-offset-2 hover:underline"
      >
        Смотреть в истории →
      </Link>
    </div>
  );
}

export function CategoryProgressList({
  categoryProgress,
  month,
  paidByUserId,
  moneyFormat,
}: {
  categoryProgress: CategoryProgress[];
  month: string;
  paidByUserId: string | null;
  moneyFormat: MoneyFormat;
}) {
  const formatMoney = useMemo(() => makeMoneyFormatter(moneyFormat), [moneyFormat]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { from, to } = monthBounds(month);

  function toggle(categoryId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {categoryProgress
        .filter(
          (category) => category.monthlyLimit !== null || Number(category.spent) > 0,
        )
        .map((category) => {
          const spent = Number(category.spent);
          const limit = category.monthlyLimit ? Number(category.monthlyLimit) : null;
          const percent = category.percent;
          const isOverLimit = percent !== null && percent > 100;
          const colorClass = isOverLimit ? "text-destructive" : "text-foreground";
          const isOpen = expanded.has(category.id);

          const historyHref = `/history?category=${category.id}&from=${from}&to=${to}${
            paidByUserId ? `&paidBy=${paidByUserId}` : ""
          }`;

          return (
            <div key={category.id}>
              <button
                type="button"
                onClick={() => toggle(category.id)}
                className="block w-full space-y-1.5 text-left"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <ChevronDownIcon
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </span>
                  <span className="tabular-nums text-[13px] text-muted-foreground">
                    <span className={`font-semibold ${colorClass}`}>
                      {formatMoney(spent)}
                    </span>
                    {limit !== null && ` из ${formatMoney(limit)}`}
                    {percent !== null && ` (${Math.round(percent)}%)`}
                  </span>
                </div>
                {limit !== null && (
                  <ProgressPrimitive.Root value={Math.min(100, percent ?? 0)}>
                    <ProgressTrack className="h-2">
                      <ProgressIndicator
                        className={isOverLimit ? "bg-destructive" : undefined}
                        style={isOverLimit ? undefined : { backgroundColor: category.color }}
                      />
                    </ProgressTrack>
                  </ProgressPrimitive.Root>
                )}
              </button>

              {isOpen && (
                <CategoryPreviewPanel
                  categoryId={category.id}
                  month={month}
                  paidByUserId={paidByUserId}
                  spentKey={category.spent}
                  historyHref={historyHref}
                  formatMoney={formatMoney}
                />
              )}
            </div>
          );
        })}
    </div>
  );
}

import { HistoryIcon } from "lucide-react";
import Link from "next/link";

import { PayTileButton } from "@/components/pay-tile-button";
import { TileAddOverlay } from "@/components/tile-add-overlay";
import { Button } from "@/components/ui/button";
import { formatMoney, moneyFormat } from "@/lib/format";
import type { PeriodTile } from "@/lib/queries/payday";
import { cn } from "@/lib/utils";

// Какую выборку открывает «История» на плашке: календарный месяц, а при выбранном
// на дашборде человеке — только его траты.
export type TileHistoryScope = {
  from: string;
  to: string;
  paidByUserId: string | null;
};

function historyHref(categoryId: string, scope: TileHistoryScope): string {
  const params = new URLSearchParams({ from: scope.from, to: scope.to, category: categoryId });
  if (scope.paidByUserId) params.set("paidBy", scope.paidByUserId);
  return `/history?${params.toString()}`;
}

// Меньше этой доли выделенного — плашка «горит».
const LOW_REMAINING_SHARE = 0.15;

// Обязательный платёж, по которому в периоде уже всё оплачено.
const isClosed = (tile: PeriodTile) => tile.fixed && tile.remaining <= 0 && tile.spent > 0;

function Tile({
  tile,
  canPay,
  history,
}: {
  tile: PeriodTile;
  canPay: boolean;
  // null — у плашки нет настоящей категории («Запас на жизнь»): ни истории, ни клика.
  history: TileHistoryScope | null;
}) {
  const isOver = tile.remaining < 0;
  const closed = isClosed(tile);
  // Обязательный платёж, который ещё предстоит оплатить, выделяем обводкой.
  const isPending = tile.fixed && !closed;
  const isLow = !isOver && tile.allocated > 0 && tile.remaining / tile.allocated < LOW_REMAINING_SHARE;
  const usedPercent =
    tile.allocated > 0 ? Math.min(100, (tile.spent / tile.allocated) * 100) : isOver ? 100 : 0;

  // Обязательные платежи: «Заплатил» или отметка об оплате — рядом с историей.
  const status = !tile.fixed ? null : tile.remaining > 0 ? (
    canPay ? (
      <PayTileButton
        categoryId={tile.id}
        name={tile.name}
        remaining={tile.remaining}
        moneyFormat={moneyFormat()}
      />
    ) : null
  ) : tile.spent > 0 ? (
    <span className="text-[12px] font-medium text-positive">✓ Оплачено</span>
  ) : null;

  // Клик по плашке открывает окно новой траты в её категорию.
  const clickable = history !== null && canPay;

  return (
    <div
      className={cn(
        "relative rounded-2xl bg-card p-3.5",
        isPending && "ring-2 ring-primary/70",
        closed && "opacity-60",
        // Ховер как у карточек целей.
        clickable && "transition-shadow hover:shadow-md",
      )}
    >
      {clickable && <TileAddOverlay categoryId={tile.id} name={tile.name} />}
      {(status || history) && (
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          {status}
          {history && (
            <Button
              variant="ghost"
              size="icon-xs"
              nativeButton={false}
              render={
                <Link
                  href={historyHref(tile.id, history)}
                  aria-label={`История за месяц: ${tile.name}`}
                  title="История за месяц"
                />
              }
            >
              <HistoryIcon />
            </Button>
          )}
        </div>
      )}
      <p
        className={cn(
          "flex items-center gap-1.5 truncate text-[13px] text-muted-foreground",
          // Название не должно уезжать под кнопки в углу.
          status ? "pr-28" : history && "pr-8",
        )}
      >
        <span
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ backgroundColor: tile.color ?? "var(--muted-foreground)" }}
        />
        <span className="truncate">{tile.name}</span>
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums tracking-tight",
          isOver && "text-destructive",
        )}
      >
        {isOver ? "−" : ""}
        {formatMoney(Math.abs(tile.remaining))}
      </p>
      <p className="text-[12px] tabular-nums text-muted-foreground">
        {isOver
          ? `перерасход · выделено ${formatMoney(tile.allocated)}`
          : tile.allocated > 0
            ? `осталось из ${formatMoney(tile.allocated)}`
            : "тратите сверх выделенного"}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isOver ? "bg-destructive" : isLow ? "bg-warning" : "bg-positive",
          )}
          style={{ width: `${usedPercent}%` }}
        />
      </div>
    </div>
  );
}

// Плашки «сколько ещё можно потратить» по категориям до следующей выплаты.
// Сверху то, что вот-вот закончится; оплаченные обязательные платежи уходят в
// конец. С новой выплатой траты периода обнуляются, и они возвращаются наверх.
export function RemainingTiles({
  tiles,
  reserve,
  canPay,
  history,
}: {
  tiles: PeriodTile[];
  reserve: PeriodTile | null;
  // «Заплатил» и клик по плашке записывают трату на текущего пользователя,
  // поэтому доступны, только если эти плашки — его бюджет.
  canPay: boolean;
  history: TileHistoryScope;
}) {
  const share = (tile: PeriodTile) => (tile.allocated > 0 ? tile.remaining / tile.allocated : -1);
  const byShare = (a: PeriodTile, b: PeriodTile) => share(a) - share(b);
  const open = tiles.filter((tile) => !isClosed(tile)).sort(byShare);
  const closed = tiles.filter(isClosed).sort(byShare);
  const all = [...open, ...(reserve ? [reserve] : []), ...closed];

  if (all.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {all.map((tile) => (
        <Tile key={tile.id} tile={tile} canPay={canPay} history={tile === reserve ? null : history} />
      ))}
    </div>
  );
}

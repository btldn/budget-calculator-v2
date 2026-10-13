"use client";

import { CheckIcon, MinusIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ChipGroup } from "@/components/chip-group";
import { AmountField, MoneyInput } from "@/components/money-input";
import { PaycheckSplitBar } from "@/components/paycheck-split-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Money = (amount: number) => string;

export type SplitBarData = {
  totalCents: number;
  liveCents: number;
  saveCents: number;
  freeCents: number;
  isOver: boolean;
};

function Callout({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-lg px-3 py-2 text-[13px]",
        tone === "warning" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

// ───────────────────────── Шаг 1. Сколько пришло ─────────────────────────

export type PayOption = { value: string; label: string; hint: string };

export function AmountStep({
  options,
  choice,
  onChoice,
  isExtra,
  amount,
  onAmount,
  onEnter,
  currency,
  lastAmount,
  formatMoney,
  dateLabel,
  receivedOn,
  onReceivedOn,
  incomeCategories,
  incomeCategoryId,
  onIncomeCategory,
  detailsOpen,
  onToggleDetails,
}: {
  options: PayOption[];
  choice: string;
  onChoice: (value: string) => void;
  isExtra: boolean;
  amount: string;
  onAmount: (value: string) => void;
  onEnter: () => void;
  currency: string;
  // Сколько пришло по этой выплате в прошлый раз (null — не было).
  lastAmount: number | null;
  formatMoney: Money;
  dateLabel: string;
  receivedOn: string;
  onReceivedOn: (value: string) => void;
  incomeCategories: { id: string; name: string }[];
  incomeCategoryId: string;
  onIncomeCategory: (id: string) => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}) {
  const incomeName = incomeCategories.find((c) => c.id === incomeCategoryId)?.name ?? "доход";

  return (
    <div className="space-y-5">
      {options.length <= 4 ? (
        <ChipGroup chips={options} value={choice} onChange={onChoice} ariaLabel="Какая выплата" />
      ) : (
        <Select
          items={Object.fromEntries(options.map((o) => [o.value, `${o.label} — ${o.hint}`]))}
          value={choice}
          onValueChange={(value) => onChoice(value as string)}
        >
          <SelectTrigger className="h-10 w-full" aria-label="Какая выплата">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label} — {option.hint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div>
        <AmountField
          value={amount}
          onValueChange={onAmount}
          onEnter={onEnter}
          currency={currency}
          placeholder="0"
          aria-label="Сколько пришло"
        />
        {lastAmount !== null && Number(amount) !== lastAmount && (
          <div className="mt-3 flex justify-center">
            <Button type="button" variant="ghost" size="sm" onClick={() => onAmount(String(lastAmount))}>
              В прошлый раз было {formatMoney(lastAmount)} — подставить
            </Button>
          </div>
        )}
      </div>

      {isExtra && (
        <Callout>Премия и подработка не идут на лимиты категорий — сразу в цели.</Callout>
      )}

      <div>
        <button
          type="button"
          onClick={onToggleDetails}
          aria-expanded={detailsOpen}
          className="flex w-full items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-left text-sm"
        >
          <span>
            {dateLabel} · как «{incomeName}»
          </span>
          <span className="text-muted-foreground">{detailsOpen ? "Скрыть" : "Изменить"}</span>
        </button>
        {detailsOpen && (
          <div className="grid gap-3 pt-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-[13px] text-muted-foreground">
              Когда пришла
              <Input
                type="date"
                value={receivedOn}
                onChange={(event) => onReceivedOn(event.target.value)}
                className="h-10 text-foreground"
              />
            </label>
            {incomeCategories.length > 1 && (
              <div className="space-y-1.5 text-[13px] text-muted-foreground">
                Учесть как доход
                <Select
                  items={Object.fromEntries(incomeCategories.map((c) => [c.id, c.name]))}
                  value={incomeCategoryId}
                  onValueChange={(value) => onIncomeCategory(value as string)}
                >
                  <SelectTrigger className="h-10 w-full text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Шаг 2. Жить до следующей зарплаты ─────────────────────────

const RESERVE_STEP = 1000;

export function LiveStep({
  formatMoney,
  bar,
  spendableCents,
  perDayCents,
  daysLeft,
  categoriesCents,
  spendRows,
  shortfallCents,
  reserveValue,
  onReserve,
  reserveHint,
  cushion,
}: {
  formatMoney: Money;
  bar: SplitBarData;
  spendableCents: number;
  perDayCents: number | null;
  daysLeft: number | null;
  categoriesCents: number;
  spendRows: { id: string; name: string; amountCents: number }[];
  shortfallCents: number;
  // Сырая строка из поля «запас на жизнь».
  reserveValue: string;
  onReserve: (value: string) => void;
  reserveHint: string;
  // Ориентир по подушке, если целей ещё нет.
  cushion: { low: number; high: number } | null;
}) {
  const reserveUnits = Math.floor(Number(reserveValue) || 0);
  const shift = (delta: number) => onReserve(String(Math.max(0, reserveUnits + delta)));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-3xl font-semibold tabular-nums tracking-tight">
          {formatMoney(spendableCents / 100)}
        </p>
        {perDayCents !== null && daysLeft !== null && (
          <p className="text-sm tabular-nums text-muted-foreground">
            ≈ {formatMoney(perDayCents / 100)} в день · осталось {daysLeft} дн.
          </p>
        )}
      </div>

      <PaycheckSplitBar {...bar} formatMoney={formatMoney} />

      {shortfallCents > 0 && (
        <Callout tone="warning">
          Не хватает {formatMoney(shortfallCents / 100)} до плана по категориям — выплата меньше
          обычной, лимиты урезаны пропорционально.
        </Callout>
      )}

      <div className="divide-y divide-border rounded-xl border border-border">
        <details className="group px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm">
            <span>
              Траты по категориям
              <span className="ml-1.5 text-[12px] text-muted-foreground group-open:hidden">
                показать
              </span>
            </span>
            <span className="font-semibold tabular-nums">{formatMoney(categoriesCents / 100)}</span>
          </summary>
          <div className="mt-2 space-y-1">
            {spendRows.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Лимитов по категориям пока нет — задайте их в настройках.
              </p>
            ) : (
              spendRows.map((row) => (
                <div key={row.id} className="flex justify-between gap-2 text-[13px]">
                  <span className="text-muted-foreground">{row.name}</span>
                  <span className="tabular-nums">{formatMoney(row.amountCents / 100)}</span>
                </div>
              ))
            )}
          </div>
        </details>

        <div className="space-y-1.5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="paycheck-reserve" className="text-sm">
              Запас на жизнь
            </label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Уменьшить запас на ${RESERVE_STEP}`}
                disabled={reserveUnits <= 0}
                onClick={() => shift(-RESERVE_STEP)}
              >
                <MinusIcon />
              </Button>
              <MoneyInput
                id="paycheck-reserve"
                value={reserveValue}
                onValueChange={onReserve}
                className="h-8 w-24 text-right tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Увеличить запас на ${RESERVE_STEP}`}
                onClick={() => shift(RESERVE_STEP)}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>
          <p className="text-[12px] text-muted-foreground">{reserveHint}</p>
        </div>
      </div>

      {cushion && (
        <Callout>
          Целей пока нет. Начните с подушки безопасности: 3–6 месяцев расходов — это{" "}
          {formatMoney(cushion.low)}–{formatMoney(cushion.high)}.{" "}
          <Link href="/goals" className="underline underline-offset-2">
            Добавить цель
          </Link>
        </Callout>
      )}
    </div>
  );
}

// ───────────────────────── Шаг 3. Копим ─────────────────────────

export type SaveRow = {
  id: string;
  rank: number;
  title: string;
  caption: string;
  value: string;
};

export function SaveStep({
  formatMoney,
  bar,
  rows,
  onGoal,
  goalsCents,
  sharePercent,
  showBenchmark,
  freeCents,
  isOver,
}: {
  formatMoney: Money;
  bar: SplitBarData;
  rows: SaveRow[];
  onGoal: (id: string, value: string) => void;
  goalsCents: number;
  sharePercent: number;
  showBenchmark: boolean;
  freeCents: number;
  isOver: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-3xl font-semibold tabular-nums tracking-tight">
          {formatMoney(goalsCents / 100)}
        </p>
        <p className="text-sm text-muted-foreground">
          на цели · {sharePercent}% выплаты
          {showBenchmark &&
            (sharePercent < 10
              ? " — ниже ориентира 10–20%"
              : sharePercent <= 20
                ? " — в рамках ориентира 10–20%"
                : " — выше ориентира 10–20%")}
        </p>
      </div>

      <PaycheckSplitBar {...bar} formatMoney={formatMoney} />

      <div className="divide-y divide-border rounded-xl border border-border">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm">
                <span className="mr-1.5 text-[12px] tabular-nums text-muted-foreground">№{row.rank}</span>
                {row.title}
              </p>
              <p className="text-[12px] text-muted-foreground">{row.caption}</p>
            </div>
            <MoneyInput
              value={row.value}
              onValueChange={(value) => onGoal(row.id, value)}
              aria-label={`Отложить на цель «${row.title}»`}
              className="h-9 w-28 shrink-0 text-right tabular-nums"
            />
          </div>
        ))}
      </div>

      <div
        aria-live="polite"
        className={cn(
          "flex items-baseline justify-between gap-2 text-sm",
          isOver && "text-destructive",
        )}
      >
        <span className="font-medium">{isOver ? "Распределено лишнего" : "Свободно"}</span>
        <span className="font-semibold tabular-nums">{formatMoney(Math.abs(freeCents) / 100)}</span>
      </div>
      {isOver && (
        <Callout tone="warning">
          Распределено больше, чем пришло. Уменьшите суммы по целям или запас на предыдущем шаге.
        </Callout>
      )}
    </div>
  );
}

// ───────────────────────── Готово ─────────────────────────

export function DoneStep({
  formatMoney,
  isExtra,
  periodLabel,
  spendableCents,
  perDayCents,
  transfers,
}: {
  formatMoney: Money;
  isExtra: boolean;
  periodLabel: string;
  spendableCents: number;
  perDayCents: number | null;
  // Что отложить «в банке»: приложение счетов не ведёт, поэтому это памятка.
  transfers: { lines: { label: string; cents: number }[]; totalCents: number };
}) {
  return (
    <div className="space-y-5">
      {!isExtra && (
        <div className="rounded-xl bg-muted/60 px-4 py-3">
          <p className="text-[13px] text-muted-foreground">Можно тратить {periodLabel}</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {formatMoney(spendableCents / 100)}
          </p>
          {perDayCents !== null && (
            <p className="text-sm tabular-nums text-muted-foreground">
              ≈ {formatMoney(perDayCents / 100)} в день
            </p>
          )}
        </div>
      )}

      {transfers.totalCents > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Что сделать в банке</h4>
          <p className="text-sm">
            Переведите на накопительный{" "}
            <span className="font-semibold tabular-nums">{formatMoney(transfers.totalCents / 100)}</span>
          </p>
          <ul className="space-y-1 text-[13px] text-muted-foreground">
            {transfers.lines.map((line) => (
              <li key={line.label} className="flex justify-between gap-2">
                <span>{line.label}</span>
                <span className="tabular-nums">{formatMoney(line.cents / 100)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckIcon className="size-4" /> Переводить никуда не нужно.
        </p>
      )}
    </div>
  );
}

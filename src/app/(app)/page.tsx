import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import Link from "next/link";

import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { ExpensesChart } from "@/components/expenses-chart";
import { ExpensesDonut, type DonutSlice } from "@/components/expenses-donut";
import { MonthSwitcher } from "@/components/month-switcher";
import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { formatDate, formatMoney } from "@/lib/format";
import {
  getCategoryProgress,
  getCurrentMonth,
  getDailyExpenses,
  getMonthExpenseIncome,
  getMonthlyExpenseLimit,
  getPreviousMonth,
} from "@/lib/queries/dashboard";
import { getRecentTransactions } from "@/lib/queries/transactions";

const GENITIVE_MONTHS = [
  "январе",
  "феврале",
  "марте",
  "апреле",
  "мае",
  "июне",
  "июле",
  "августе",
  "сентябре",
  "октябре",
  "ноябре",
  "декабре",
];

const OTHER_SLICE_COLOR = "#94a3b8";
const MAX_DONUT_SLICES = 7;
const RECENT_TRANSACTIONS_LIMIT = 10;

function monthInLabel(month: string): string {
  const m = Number(month.split("-")[1]);
  return GENITIVE_MONTHS[m - 1];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month ?? getCurrentMonth();
  const previousMonth = getPreviousMonth(month);

  const [current, previous, categoryProgress, dailyExpenses, monthlyLimit, recent] =
    await Promise.all([
      getMonthExpenseIncome(month),
      getMonthExpenseIncome(previousMonth),
      getCategoryProgress(month),
      getDailyExpenses(month),
      getMonthlyExpenseLimit(),
      getRecentTransactions(RECENT_TRANSACTIONS_LIMIT),
    ]);

  const income = Number(current.income);
  const expense = Number(current.expense);
  const balance = income - expense;
  const savingsRate = income > 0 ? balance / income : null;

  const prevExpense = Number(previous.expense);
  const delta = prevExpense > 0 ? (expense - prevExpense) / prevExpense : null;

  const isEmptyMonth = current.transactionCount === 0;

  const donutSource = categoryProgress
    .map((c) => ({ name: c.name, value: Number(c.spent), color: c.color }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const donutData: DonutSlice[] =
    donutSource.length > MAX_DONUT_SLICES
      ? [
          ...donutSource.slice(0, MAX_DONUT_SLICES),
          {
            name: "Прочее",
            value: donutSource
              .slice(MAX_DONUT_SLICES)
              .reduce((sum, c) => sum + c.value, 0),
            color: OTHER_SLICE_COLOR,
          },
        ]
      : donutSource;

  return (
    <div className="space-y-10">
      <MonthSwitcher month={month} />

      <section>
        {isEmptyMonth ? (
          <DashboardEmptyState message="Ещё ни одной траты в этом месяце. Добавить первую?" />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Доходы</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatMoney(income)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Расходы</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatMoney(expense)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Остаток</p>
              <p
                className={`text-3xl font-bold tabular-nums ${
                  balance >= 0
                    ? "text-[oklch(0.6_0.15_150)]"
                    : "text-destructive"
                }`}
              >
                {formatMoney(balance)}
              </p>
              <p className="text-sm text-muted-foreground">
                {savingsRate !== null &&
                  `норма сбережений ${Math.round(savingsRate * 100)}%`}
                {savingsRate !== null && delta !== null && " · "}
                {delta !== null &&
                  `на ${Math.abs(Math.round(delta * 100))}% ${
                    delta <= 0 ? "меньше" : "больше"
                  }, чем в ${monthInLabel(previousMonth)}`}
              </p>
            </div>
          </div>
        )}
      </section>

      {!isEmptyMonth && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Расходы по дням
            </h2>
            <ExpensesChart data={dailyExpenses} monthlyLimit={monthlyLimit} />
          </section>

          {donutData.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Структура расходов
              </h2>
              <ExpensesDonut data={donutData} totalLabel={formatMoney(expense)} />
            </section>
          )}
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Категории: факт против лимита
        </h2>
        {isEmptyMonth ? (
          <DashboardEmptyState message="Пока не с чем сравнивать лимиты — добавьте первую трату." />
        ) : (
          <div className="space-y-3">
            {categoryProgress.map((category) => {
              const spent = Number(category.spent);
              const limit = category.monthlyLimit
                ? Number(category.monthlyLimit)
                : null;
              const percent = category.percent;
              const colorClass =
                percent !== null && percent > 100
                  ? "text-destructive"
                  : percent !== null && percent >= 85
                    ? "text-[oklch(0.75_0.15_80)]"
                    : "text-foreground";

              return (
                <Link
                  key={category.id}
                  href={`/history?category=${category.id}`}
                  className="block space-y-1"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </span>
                    <span className={`tabular-nums ${colorClass}`}>
                      {formatMoney(spent)}
                      {limit !== null && ` / ${formatMoney(limit)}`}
                      {percent !== null && ` (${Math.round(percent)}%)`}
                    </span>
                  </div>
                  {limit !== null && (
                    <ProgressPrimitive.Root value={Math.min(100, percent ?? 0)}>
                      <ProgressTrack>
                        <ProgressIndicator
                          className={
                            percent !== null && percent > 100
                              ? "bg-destructive"
                              : percent !== null && percent >= 85
                                ? "bg-[oklch(0.75_0.15_80)]"
                                : undefined
                          }
                        />
                      </ProgressTrack>
                    </ProgressPrimitive.Root>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Последние операции
          </h2>
          <Link
            href="/history"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Вся история
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-muted-foreground">Операций пока нет.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.categoryColor }}
                  />
                  <span>{row.categoryName}</span>
                  {row.note && (
                    <span className="text-muted-foreground">— {row.note}</span>
                  )}
                </span>
                <span className="flex items-center gap-3 whitespace-nowrap text-muted-foreground">
                  <span>{formatDate(row.occurredOn)}</span>
                  <span
                    className={`tabular-nums ${
                      row.kind === "income" ? "text-[oklch(0.6_0.15_150)]" : "text-foreground"
                    }`}
                  >
                    {row.kind === "income" ? "+" : "−"}
                    {formatMoney(row.amount)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

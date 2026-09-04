import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import Link from "next/link";

import { ExpensesChart } from "@/components/expenses-chart";
import { ExpensesDonut, type DonutSlice } from "@/components/expenses-donut";
import { MonthSwitcher } from "@/components/month-switcher";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { getCategoryEmoji } from "@/lib/category-emoji";
import { formatMoney } from "@/lib/format";
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

const DATIVE_MONTHS = [
  "январю",
  "февралю",
  "марту",
  "апрелю",
  "маю",
  "июню",
  "июлю",
  "августу",
  "сентябрю",
  "октябрю",
  "ноябрю",
  "декабрю",
];

const OTHER_SLICE_COLOR = "#94a3b8";
const MAX_DONUT_SLICES = 7;
const RECENT_TRANSACTIONS_LIMIT = 10;

function monthInLabel(month: string): string {
  const m = Number(month.split("-")[1]);
  return GENITIVE_MONTHS[m - 1];
}

function monthToLabel(month: string): string {
  const m = Number(month.split("-")[1]);
  return DATIVE_MONTHS[m - 1];
}

function comparisonLabel(diff: number | null, previousMonth: string): string | null {
  if (diff === null) return null;
  if (diff === 0) return `Столько же, сколько в ${monthInLabel(previousMonth)}`;
  const sign = diff > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(diff))} к ${monthToLabel(previousMonth)}`;
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

  const prevIncome = Number(previous.income);
  const prevExpense = Number(previous.expense);
  const incomeDiff = previous.transactionCount > 0 ? income - prevIncome : null;
  const expenseDiff = previous.transactionCount > 0 ? expense - prevExpense : null;
  const incomeComparison = comparisonLabel(incomeDiff, previousMonth);
  const expenseComparison = comparisonLabel(expenseDiff, previousMonth);

  const lastActiveDay = [...dailyExpenses].reverse().find((d) => d.amount > 0) ?? null;
  const daysInMonth = dailyExpenses.length;
  const planToDate =
    lastActiveDay && monthlyLimit > 0
      ? (monthlyLimit * lastActiveDay.day) / daysInMonth
      : null;
  const actualToDate = lastActiveDay ? lastActiveDay.cumulative : 0;
  const chartDiff = planToDate !== null ? actualToDate - planToDate : null;

  const donutSource = categoryProgress
    .map((c) => ({
      id: c.id,
      name: c.name,
      value: Number(c.spent),
      amountLabel: formatMoney(c.spent),
      color: c.color,
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const otherTotal = donutSource
    .slice(MAX_DONUT_SLICES)
    .reduce((sum, c) => sum + c.value, 0);

  const donutData: DonutSlice[] =
    donutSource.length > MAX_DONUT_SLICES
      ? [
          ...donutSource.slice(0, MAX_DONUT_SLICES),
          {
            name: "Прочее",
            value: otherTotal,
            amountLabel: formatMoney(otherTotal),
            color: OTHER_SLICE_COLOR,
          },
        ]
      : donutSource.length > 0
        ? donutSource
        : [
            {
              name: "Нет расходов",
              value: 1,
              amountLabel: formatMoney(0),
              color: "var(--border)",
            },
          ];

  return (
    <div className="space-y-4">
      <MonthSwitcher month={month} />

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12">
          <CardContent>
            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="py-3 first:pt-0 sm:py-0 sm:pr-7">
                <p className="text-sm text-muted-foreground">Доходы</p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-[30px]">
                  {formatMoney(income)}
                </p>
                {incomeComparison && (
                  <p className="text-sm text-muted-foreground">{incomeComparison}</p>
                )}
              </div>
              <div className="py-3 sm:px-7">
                <p className="text-sm text-muted-foreground">Расходы</p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-[30px]">
                  {formatMoney(expense)}
                </p>
                {expenseComparison && (
                  <p className="text-sm text-muted-foreground">{expenseComparison}</p>
                )}
              </div>
              <div className="py-3 last:pb-0 sm:py-0 sm:px-7">
                <p className="text-sm text-muted-foreground">Остаток</p>
                <p
                  className={`text-2xl font-semibold tabular-nums tracking-tight sm:text-[30px] ${
                    balance >= 0 ? "text-positive" : "text-destructive"
                  }`}
                >
                  {formatMoney(balance)}
                </p>
                {savingsRate !== null && (
                  <p className="text-sm text-muted-foreground">
                    норма сбережений {Math.round(savingsRate * 100)}%
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-8">
          <CardContent>
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              Расходы по дням
            </h2>
            <ExpensesChart data={dailyExpenses} monthlyLimit={monthlyLimit} />
            {planToDate !== null && chartDiff !== null && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Факт {formatMoney(actualToDate)} из плана {formatMoney(planToDate)}{" "}
                —{" "}
                {chartDiff <= 0
                  ? `уложились с запасом ${formatMoney(Math.abs(chartDiff))}`
                  : `превысили на ${formatMoney(chartDiff)}`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-4">
          <CardContent>
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              Структура расходов
            </h2>
            <ExpensesDonut data={donutData} totalLabel={formatMoney(expense)} />
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-8">
          <CardContent>
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              Категории: факт против лимита
            </h2>
            <div className="space-y-4">
              {categoryProgress
                .filter(
                  (category) =>
                    category.monthlyLimit !== null || Number(category.spent) > 0,
                )
                .map((category) => {
                  const spent = Number(category.spent);
                  const limit = category.monthlyLimit
                    ? Number(category.monthlyLimit)
                    : null;
                  const percent = category.percent;
                  const isOverLimit = percent !== null && percent > 100;
                  const colorClass = isOverLimit ? "text-destructive" : "text-foreground";

                  return (
                    <Link
                      key={category.id}
                      href={`/history?category=${category.id}`}
                      className={`block space-y-1.5 ${limit === null ? "mt-2" : ""}`}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
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
                              style={
                                isOverLimit ? undefined : { backgroundColor: category.color }
                              }
                            />
                          </ProgressTrack>
                        </ProgressPrimitive.Root>
                      )}
                    </Link>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-4">
          <CardContent>
            <h2 className="mb-1 text-sm font-medium text-muted-foreground">
              Последние операции
            </h2>
            {recent.length === 0 ? (
              <p className="text-muted-foreground">Операций пока нет.</p>
            ) : (
              <div className="divide-y divide-border">
                {recent.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 py-3 text-sm">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-base"
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
                      <span className="block truncate text-[12.5px] text-muted-foreground">
                        {row.categoryName} · {row.paidByName}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${
                        row.kind === "income" ? "text-positive" : "text-foreground"
                      }`}
                    >
                      {row.kind === "income" ? "+" : "−"}
                      {formatMoney(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/history"
              className="mt-3 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Вся история
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

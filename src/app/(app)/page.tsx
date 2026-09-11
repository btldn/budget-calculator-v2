import Link from "next/link";

import { CategoryProgressList } from "@/components/category-progress-list";
import { ExpensesChart } from "@/components/expenses-chart";
import { ExpensesDonut, type DonutSlice } from "@/components/expenses-donut";
import { MonthSwitcher } from "@/components/month-switcher";
import { PersonSwitcher } from "@/components/person-switcher";
import { Card, CardContent } from "@/components/ui/card";
import { getCategoryEmoji } from "@/lib/category-emoji";
import { getAllUsers } from "@/lib/current-user";
import { formatShortDate } from "@/lib/format-client";
import { formatMoney, moneyFormat } from "@/lib/format";
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
  searchParams: Promise<{ month?: string; paidBy?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month ?? getCurrentMonth();
  const previousMonth = getPreviousMonth(month);
  const currentDay = month === getCurrentMonth() ? new Date().getDate() : null;

  const users = await getAllUsers();
  const paidByUserId = users.some((user) => user.id === sp.paidBy)
    ? (sp.paidBy as string)
    : null;

  const [current, previous, categoryProgress, dailyExpenses, monthlyLimit, recent] =
    await Promise.all([
      getMonthExpenseIncome(month, paidByUserId),
      getMonthExpenseIncome(previousMonth, paidByUserId),
      getCategoryProgress(month, paidByUserId),
      getDailyExpenses(month, paidByUserId),
      getMonthlyExpenseLimit(paidByUserId),
      getRecentTransactions(RECENT_TRANSACTIONS_LIMIT, paidByUserId),
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
      <div className="flex flex-col items-center gap-2 sm:grid sm:grid-cols-3 sm:items-center">
        <div className="hidden sm:block" />
        <MonthSwitcher month={month} paidByUserId={paidByUserId} />
        {users.length > 1 && (
          <div className="flex justify-center sm:justify-end">
            <PersonSwitcher
              users={users}
              month={month}
              paidByUserId={paidByUserId}
            />
          </div>
        )}
      </div>

      <Card>
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Card>
            <CardContent>
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                Расходы по дням
              </h2>
              <ExpensesChart
                data={dailyExpenses}
                monthlyLimit={monthlyLimit}
                currentDay={currentDay}
              />
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

          <Card>
            <CardContent>
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                Категории: факт против лимита
              </h2>
              <CategoryProgressList
                categoryProgress={categoryProgress}
                month={month}
                paidByUserId={paidByUserId}
                moneyFormat={moneyFormat()}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:w-[380px] lg:shrink-0 xl:w-[420px]">
          <Card>
            <CardContent>
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                Структура расходов
              </h2>
              <ExpensesDonut data={donutData} totalLabel={formatMoney(expense)} />
            </CardContent>
          </Card>

          <Card>
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
                          {row.categoryName} · {row.paidByName} ·{" "}
                          {formatShortDate(row.occurredOn)}
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
    </div>
  );
}

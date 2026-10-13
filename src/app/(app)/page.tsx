import Link from "next/link";

import { ExpensesDonut, type DonutSlice } from "@/components/expenses-donut";
import { GoalsStrip } from "@/components/goals-strip";
import { MonthSwitcher } from "@/components/month-switcher";
import { PaycheckProvider } from "@/components/paycheck-dialog";
import { PaydaySummary } from "@/components/payday-summary";
import { PersonSwitcher } from "@/components/person-switcher";
import { RemainingTiles } from "@/components/remaining-tiles";
import { Card, CardContent } from "@/components/ui/card";
import { getCategoryEmoji } from "@/lib/category-emoji";
import { getAllUsers, getCurrentUser } from "@/lib/current-user";
import { formatShortDate } from "@/lib/format-client";
import { formatMoney } from "@/lib/format";
import { parseIsoDate, toIsoDate } from "@/lib/payday/schedule";
import {
  getCategoryProgress,
  getCurrentMonth,
  getMonthExpenseIncome,
  getMonthRange,
} from "@/lib/queries/dashboard";
import { getGoals } from "@/lib/queries/goals";
import {
  getAllocationDrift,
  getCurrentPeriodBudget,
  getPaydayStatus,
  type PaydayStatus,
} from "@/lib/queries/payday";
import { getRecentTransactions } from "@/lib/queries/transactions";

const OTHER_SLICE_COLOR = "#94a3b8";
const MAX_DONUT_SLICES = 7;
const RECENT_TRANSACTIONS_LIMIT = 10;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; paidBy?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month ?? getCurrentMonth();
  const isCurrentMonth = month === getCurrentMonth();

  const [users, currentUser] = await Promise.all([getAllUsers(), getCurrentUser()]);
  const paidByUserId = users.some((user) => user.id === sp.paidBy)
    ? (sp.paidBy as string)
    : null;

  // Бюджет «от зп до зп» имеет смысл только для текущего месяца.
  const budgetUserIds = paidByUserId ? [paidByUserId] : users.map((user) => user.id);
  const noPayday: PaydayStatus = { kind: "no-schedule" };

  const [current, categoryProgress, recent, goals, periodBudget, paydayStatus, drift] =
    await Promise.all([
      getMonthExpenseIncome(month, paidByUserId),
      getCategoryProgress(month, paidByUserId),
      getRecentTransactions(RECENT_TRANSACTIONS_LIMIT, paidByUserId),
      getGoals(),
      isCurrentMonth ? getCurrentPeriodBudget(budgetUserIds) : null,
      isCurrentMonth && currentUser ? getPaydayStatus(currentUser.id) : noPayday,
      isCurrentMonth && currentUser ? getAllocationDrift(currentUser.id) : null,
    ]);

  // Плашки и их кнопки действуют от имени текущего человека, поэтому показываем
  // их только когда на экране его собственный бюджет.
  const ownsBudget =
    !!currentUser &&
    paydayStatus.kind === "ready" &&
    (paidByUserId === null || paidByUserId === currentUser.id);

  const expense = Number(current.expense);

  // «История» на плашках открывает выбранный месяц целиком; getMonthRange отдаёт
  // первый день следующего месяца, а фильтр истории включает граничную дату.
  const { start: monthStart, end: nextMonthStart } = getMonthRange(month);
  const monthEnd = parseIsoDate(nextMonthStart);
  monthEnd.setDate(monthEnd.getDate() - 1);

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
    <PaycheckProvider>
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

        <GoalsStrip goals={goals} />

        {isCurrentMonth && currentUser && (
          <>
            <PaydaySummary status={paydayStatus} budget={periodBudget} drift={ownsBudget ? drift : null} />
            {periodBudget && (
              <RemainingTiles
                tiles={periodBudget.tiles}
                reserve={periodBudget.reserve}
                canPay={ownsBudget}
                history={{ from: monthStart, to: toIsoDate(monthEnd), paidByUserId }}
              />
            )}
          </>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
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

          <div className="flex flex-col gap-4 lg:w-[380px] lg:shrink-0 xl:w-[420px]">
            <Card>
              <CardContent>
                <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                  Структура расходов
                </h2>
                <ExpensesDonut data={donutData} totalLabel={formatMoney(expense)} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PaycheckProvider>
  );
}

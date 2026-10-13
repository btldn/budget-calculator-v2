import Link from "next/link";

import { PaycheckButton } from "@/components/paycheck-dialog";
import { ReallocateButton } from "@/components/reallocate-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, moneyFormat } from "@/lib/format";
import type { AllocationDrift, PaydayStatus, PeriodBudget } from "@/lib/queries/payday";

function formatDayMonth(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(moneyFormat().locale, {
    day: "numeric",
    month: "long",
  });
}

// Главный вопрос приложения-помощника: «сколько можно потратить до следующей
// зарплаты». Рядом — кнопка «Пришла зарплата»; она подсвечена, когда плановая
// выплата уже наступила.
export function PaydaySummary({
  status,
  budget,
  drift,
}: {
  // Статус текущего пользователя — именно он вносит зарплату кнопкой.
  status: PaydayStatus;
  budget: PeriodBudget | null;
  // Лимиты поменялись после зарплаты — раскладку можно обновить (null — не нужно).
  drift: AllocationDrift | null;
}) {
  if (status.kind === "no-schedule" && !budget) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Укажите, когда приходит зарплата</p>
            <p className="text-sm text-muted-foreground">
              Тогда приложение будет само раскладывать выплату по категориям и целям.
            </p>
          </div>
          <Button variant="outline" nativeButton={false} render={<Link href="/settings" />}>
            Настроить выплаты
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isDue = status.kind === "ready" && status.due;

  if (!budget) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Пришла зарплата?</p>
            <p className="text-sm text-muted-foreground">
              Внесите сумму — разложим по категориям и целям и покажем, сколько можно тратить.
            </p>
          </div>
          <PaycheckButton>Пришла зарплата</PaycheckButton>
        </CardContent>
      </Card>
    );
  }

  const perDay =
    budget.daysLeft !== null && budget.daysLeft > 0 ? budget.spendable / budget.daysLeft : null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Можно потратить{" "}
            {budget.periodEnd
              ? `до ${formatDayMonth(budget.periodEnd)}`
              : "до следующей зарплаты"}
          </p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight sm:text-[34px]">
            {formatMoney(budget.spendable)}
          </p>
          {perDay !== null && (
            <p className="text-sm tabular-nums text-muted-foreground">
              ≈ {formatMoney(perDay)} в день
              {budget.daysLeft !== null && ` · осталось ${budget.daysLeft} дн.`}
            </p>
          )}
          {budget.fixedRemaining > 0 && (
            <p className="mt-1 text-[13px] tabular-nums text-muted-foreground">
              Без аренды и коммуналки — на них ещё {formatMoney(budget.fixedRemaining)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          {isDue && (
            <p className="text-[13px] text-muted-foreground">
              Плановая выплата уже наступила — внесите её.
            </p>
          )}
          <PaycheckButton variant={isDue ? "default" : "outline"}>
            Пришла зарплата
          </PaycheckButton>
        </div>
        {drift && (
          <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-[13px] text-muted-foreground">
            <span>Лимиты изменились после зарплаты.</span>
            <ReallocateButton drift={drift} moneyFormat={moneyFormat()} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

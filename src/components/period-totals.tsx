import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";

// Итог по выбранной выборке: доходы, расходы и что осталось. На странице
// истории считается по текущим фильтрам, поэтому сравнения с прошлым месяцем
// здесь нет — у выборки может быть любой период.
export function PeriodTotals({ income, expense }: { income: number; expense: number }) {
  const balance = income - expense;
  const savingsRate = income > 0 ? balance / income : null;

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="py-3 first:pt-0 sm:py-0 sm:pr-7">
            <p className="text-sm text-muted-foreground">Доходы</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-[30px]">
              {formatMoney(income)}
            </p>
          </div>
          <div className="py-3 sm:py-0 sm:px-7">
            <p className="text-sm text-muted-foreground">Расходы</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-[30px]">
              {formatMoney(expense)}
            </p>
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
  );
}

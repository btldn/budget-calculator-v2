import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { planGoal } from "@/lib/goals";

type Goal = {
  id: string;
  title: string;
  targetAmount: string;
  savedAmount: string;
  deadline: string | null;
};

function shortDeadline(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`;
}

// Лента целей на самом верху дашборда: цель перед глазами мотивирует не тратить
// лишнего. Порядок — приоритет цели, как на /goals.
export function GoalsStrip({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) {
    return (
      <Link
        href="/goals"
        className="block rounded-3xl border-2 border-dashed border-border px-6 py-5 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Поставьте первую цель — так копить веселее
      </Link>
    );
  }

  const now = new Date();

  return (
    <section aria-label="Цели" className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Цели</h2>
        <Link
          href="/goals"
          className="text-[13px] text-muted-foreground underline-offset-4 hover:underline"
        >
          Все цели
        </Link>
      </div>

      <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {goals.map((goal) => {
          const target = Number(goal.targetAmount);
          const saved = Number(goal.savedAmount);
          const percent = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
          const plan = planGoal(goal, now);
          const isAchieved = plan.status === "achieved";

          return (
            <Link
              key={goal.id}
              href="/goals"
              className="min-w-[210px] shrink-0 basis-[210px] snap-start sm:min-w-[190px] sm:flex-1 sm:basis-0"
            >
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate text-sm font-medium">{goal.title}</h3>
                    <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                      {Math.round(percent)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${isAchieved ? "bg-positive" : "bg-primary"}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-2 truncate text-[12.5px] tabular-nums text-muted-foreground">
                    {isAchieved
                      ? "Цель достигнута"
                      : `ещё ${formatMoney(plan.remaining)}${goal.deadline ? ` · до ${shortDeadline(goal.deadline)}` : ""}`}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

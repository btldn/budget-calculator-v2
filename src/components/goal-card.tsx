import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { GoalRowActions } from "@/components/goal-row-actions";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { formatDate, formatMoney } from "@/lib/format";
import { planGoal } from "@/lib/goals";

type Goal = {
  id: string;
  title: string;
  targetAmount: string;
  savedAmount: string;
  deadline: string | null;
};

export function GoalCard({ goal }: { goal: Goal }) {
  const target = Number(goal.targetAmount);
  const saved = Number(goal.savedAmount);
  const plan = planGoal(goal, new Date());
  const isAchieved = plan.status === "achieved";
  const percent = target > 0 ? Math.min(100, (saved / target) * 100) : 0;

  let statusLine: string;
  switch (plan.status) {
    case "achieved":
      statusLine = "Цель достигнута";
      break;
    case "expired":
      statusLine = "Срок прошёл";
      break;
    case "deadline":
      statusLine = `Чтобы успеть к ${formatDate(goal.deadline!)}, откладывайте ~${formatMoney(plan.perMonth)}/мес`;
      break;
    case "open":
      statusLine = `Осталось накопить ${formatMoney(plan.remaining)}`;
      break;
  }

  return (
    <Card className="h-full">
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium">{goal.title}</h2>
          <GoalRowActions goal={goal} />
        </div>

        <div className="mt-3 flex items-baseline justify-between text-sm">
          <span className="tabular-nums">
            <span className="font-semibold">{formatMoney(saved)}</span>
            <span className="text-muted-foreground"> из {formatMoney(target)}</span>
          </span>
          <span className="tabular-nums text-muted-foreground">
            {Math.round(percent)}%
          </span>
        </div>

        <ProgressPrimitive.Root value={percent} className="mt-2">
          <ProgressTrack className="h-2">
            <ProgressIndicator
              className={isAchieved ? "bg-positive" : undefined}
            />
          </ProgressTrack>
        </ProgressPrimitive.Root>

        {/* Справа внизу карточки лежит ручка перетаскивания приоритета. */}
        <p className="mt-3 pr-14 text-[13px] text-muted-foreground">{statusLine}</p>
      </CardContent>
    </Card>
  );
}

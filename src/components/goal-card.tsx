import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { differenceInCalendarMonths } from "date-fns";

import { GoalRowActions } from "@/components/goal-row-actions";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { formatDate, formatMoney } from "@/lib/format";

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
  const remaining = target - saved;
  const isAchieved = remaining <= 0;
  const percent = target > 0 ? Math.min(100, (saved / target) * 100) : 0;

  let statusLine: string;
  if (isAchieved) {
    statusLine = "Цель достигнута";
  } else if (goal.deadline) {
    const deadlineDate = new Date(`${goal.deadline}T00:00:00`);
    const monthsLeft = differenceInCalendarMonths(deadlineDate, new Date());
    if (monthsLeft < 0) {
      statusLine = "Срок прошёл";
    } else {
      const perMonth = remaining / Math.max(1, monthsLeft);
      statusLine = `Чтобы успеть к ${formatDate(goal.deadline)}, откладывайте ~${formatMoney(perMonth)}/мес`;
    }
  } else {
    statusLine = `Осталось накопить ${formatMoney(remaining)}`;
  }

  return (
    <Card>
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

        <p className="mt-3 text-[13px] text-muted-foreground">{statusLine}</p>
      </CardContent>
    </Card>
  );
}

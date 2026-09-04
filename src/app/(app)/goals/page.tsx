import { AddGoalDialog } from "@/components/add-goal-dialog";
import { GoalCard } from "@/components/goal-card";
import { getGoals } from "@/lib/queries/goals";

export default async function GoalsPage() {
  const goals = await getGoals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Цели</h1>
        <AddGoalDialog />
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-3xl border-2 border-dashed border-border px-6 py-10 text-center">
          <p className="text-muted-foreground">Пока нет целей. Добавить первую?</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}

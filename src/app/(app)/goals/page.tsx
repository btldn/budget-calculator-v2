import { AddGoalDialog } from "@/components/add-goal-dialog";
import { GoalCard } from "@/components/goal-card";
import { GoalList } from "@/components/goal-list";
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
        <>
          <p className="text-sm text-muted-foreground">
            Порядок — это приоритет: свободные деньги с зарплаты идут в цели сверху вниз.
            Перетащите карточку за значок №, чтобы изменить очередь.
          </p>
          <GoalList
            // Список держит порядок в state — пересоздаём, когда набор или
            // порядок целей поменялся на сервере (добавили, удалили, переставили).
            key={goals.map((goal) => goal.id).join(",")}
            items={goals.map((goal) => ({
              id: goal.id,
              card: <GoalCard goal={goal} />,
            }))}
          />
        </>
      )}
    </div>
  );
}

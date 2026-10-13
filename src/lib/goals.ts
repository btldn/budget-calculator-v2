import { differenceInCalendarMonths } from "date-fns";

export type GoalProgress = {
  targetAmount: string | number;
  savedAmount: string | number;
  deadline: string | null;
};

// Что нужно цели сейчас. Одна и та же логика кормит и карточку цели, и
// распределение зарплаты, чтобы подсказки в них не расходились.
export type GoalPlan =
  | { status: "achieved" }
  // Срок прошёл, а цель не закрыта — копить «до срока» уже нечего.
  | { status: "expired"; remaining: number }
  // months — сколько календарных месяцев (включая текущий) осталось до срока.
  | { status: "deadline"; remaining: number; perMonth: number; months: number }
  | { status: "open"; remaining: number };

export function planGoal(goal: GoalProgress, today: Date): GoalPlan {
  const remaining = Number(goal.targetAmount) - Number(goal.savedAmount);
  if (remaining <= 0) return { status: "achieved" };
  if (!goal.deadline) return { status: "open", remaining };

  const deadlineDate = new Date(`${goal.deadline}T00:00:00`);
  const monthsLeft = differenceInCalendarMonths(deadlineDate, today);
  if (monthsLeft < 0) return { status: "expired", remaining };

  const months = Math.max(1, monthsLeft);
  return { status: "deadline", remaining, perMonth: remaining / months, months };
}

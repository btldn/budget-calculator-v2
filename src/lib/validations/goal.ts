import { z } from "zod";

export const goalSchema = z.object({
  title: z
    .string()
    .min(1, { error: "Введите название цели." })
    .max(200, { error: "Слишком длинное название." }),
  targetAmount: z.coerce
    .number({ error: "Введите сумму цели." })
    .positive({ error: "Сумма должна быть больше нуля." })
    .max(100_000_000, { error: "Слишком большая сумма." }),
  savedAmount: z.coerce
    .number({ error: "Введите отложенную сумму." })
    .min(0, { error: "Сумма не может быть отрицательной." })
    .max(100_000_000, { error: "Слишком большая сумма." }),
  deadline: z.string().nullable(),
});

export type GoalFormValues = z.output<typeof goalSchema>;
export type GoalFormInput = z.input<typeof goalSchema>;

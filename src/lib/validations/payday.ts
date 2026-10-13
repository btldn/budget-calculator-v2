import { z } from "zod";

export const paySlotSchema = z.object({
  label: z
    .string()
    .min(1, { error: "Введите название." })
    .max(100, { error: "Слишком длинное название." }),
  dayOfMonth: z.coerce
    .number({ error: "Укажите число месяца." })
    .int({ error: "Число месяца должно быть целым." })
    .min(1, { error: "Число месяца — от 1 до 31." })
    .max(31, { error: "Число месяца — от 1 до 31." }),
});

export type PaySlotFormValues = z.output<typeof paySlotSchema>;
export type PaySlotFormInput = z.input<typeof paySlotSchema>;

const partAmount = z.coerce
  .number({ error: "Укажите сумму." })
  .min(0, { error: "Сумма не может быть отрицательной." })
  .max(100_000_000, { error: "Слишком большая сумма." });

// Выплата вместе с раскладкой, которую человек подтвердил в диалоге. Сервер
// ничего не пересчитывает по своему алгоритму: записывается ровно то, что
// увидел и, возможно, поправил пользователь.
export const paycheckSchema = z
  .object({
    amount: z.coerce
      .number({ error: "Введите сумму." })
      .positive({ error: "Сумма должна быть больше нуля." })
      .max(100_000_000, { error: "Слишком большая сумма." }),
    receivedOn: z.string().min(1, { error: "Укажите дату." }),
    // Внеплановая (премия, подработка): период не сбрасывает, категории не покрывает.
    isExtra: z.boolean(),
    paySlotId: z.uuid().nullable(),
    incomeCategoryId: z.uuid({ error: "Выберите категорию дохода." }),
    categories: z.array(z.object({ categoryId: z.uuid(), amount: partAmount })),
    goals: z.array(z.object({ goalId: z.uuid(), amount: partAmount })),
    reserve: partAmount,
  })
  .superRefine((values, ctx) => {
    const cents = (value: number) => Math.round(value * 100);
    const distributed =
      values.categories.reduce((sum, row) => sum + cents(row.amount), 0) +
      values.goals.reduce((sum, row) => sum + cents(row.amount), 0) +
      cents(values.reserve);

    if (distributed > cents(values.amount)) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Распределено больше, чем пришло. Уменьшите суммы по целям или запасу.",
      });
    }
  });

export type PaycheckValues = z.output<typeof paycheckSchema>;

import { z } from "zod";

export const transactionSchema = z
  .object({
    kind: z.enum(["expense", "income"]),
    amount: z.coerce
      .number({ error: "Введите сумму." })
      .positive({ error: "Сумма должна быть больше нуля." })
      .max(100_000_000, { error: "Слишком большая сумма." }),
    occurredOn: z.string().min(1, { error: "Укажите дату." }),
    categoryId: z.uuid({ error: "Выберите категорию." }).nullable(),
    scope: z.enum(["shared", "personal"]),
    paidByUserId: z.uuid({ error: "Выберите, кто платил." }),
    paymentMethodId: z.uuid().nullable(),
    goalId: z.uuid().nullable(),
    note: z.string().max(500, { error: "Слишком длинный комментарий." }),
  })
  // Пополнение цели уходит в категорию «Накопления» на сервере, поэтому
  // категория обязательна только когда цель не выбрана.
  .superRefine((values, ctx) => {
    if (!values.categoryId && !values.goalId) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Выберите категорию.",
      });
    }
  });

// Кнопка «Заплатил» на плашке: только то, что решает человек, остальное
// (кто платил, «общее», способ оплаты) сервер подставляет сам.
export const payCategorySchema = z.object({
  categoryId: z.uuid({ error: "Категория не найдена." }),
  amount: z.coerce
    .number({ error: "Введите сумму." })
    .positive({ error: "Сумма должна быть больше нуля." })
    .max(100_000_000, { error: "Слишком большая сумма." }),
  occurredOn: z.string().min(1, { error: "Укажите дату." }),
});

export type PayCategoryValues = z.output<typeof payCategorySchema>;
export type TransactionFormValues = z.output<typeof transactionSchema>;
export type TransactionFormInput = z.input<typeof transactionSchema>;

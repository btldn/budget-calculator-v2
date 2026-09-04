import { z } from "zod";

export const transactionSchema = z.object({
  kind: z.enum(["expense", "income"]),
  amount: z.coerce
    .number({ error: "Введите сумму." })
    .positive({ error: "Сумма должна быть больше нуля." })
    .max(100_000_000, { error: "Слишком большая сумма." }),
  occurredOn: z.string().min(1, { error: "Укажите дату." }),
  categoryId: z.uuid({ error: "Выберите категорию." }),
  scope: z.enum(["shared", "personal"]),
  paidByUserId: z.uuid({ error: "Выберите, кто платил." }),
  paymentMethodId: z.uuid().nullable(),
  goalId: z.uuid().nullable(),
  note: z.string().max(500, { error: "Слишком длинный комментарий." }),
});

export type TransactionFormValues = z.output<typeof transactionSchema>;
export type TransactionFormInput = z.input<typeof transactionSchema>;

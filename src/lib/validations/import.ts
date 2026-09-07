import { z } from "zod";

export const importRowSchema = z.object({
  fingerprint: z.string().min(1).max(128),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Неверная дата операции." }),
  kind: z.enum(["expense", "income"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, { error: "Неверная сумма операции." }),
  categoryId: z.uuid({ error: "У каждой строки должна быть категория." }),
  paymentMethodId: z.uuid().nullable(),
  paidByUserId: z.uuid({ error: "Выберите, кто платил." }),
  scope: z.enum(["shared", "personal"]),
  note: z.string().max(500),
  /** Заполнено, если пользователь отметил «запомнить этого мерчанта». */
  rememberPattern: z.string().trim().min(2).max(200).nullable(),
});

export const commitImportSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  rowCount: z.number().int().nonnegative(),
  rows: z.array(importRowSchema).min(1, { error: "Не выбрано ни одной операции." }),
});

export type ImportRowValues = z.output<typeof importRowSchema>;
export type CommitImportValues = z.output<typeof commitImportSchema>;

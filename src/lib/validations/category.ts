import { z } from "zod";

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, { error: "Введите название." })
    .max(100, { error: "Слишком длинное название." }),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "Цвет в формате #rrggbb." }),
});

export type CategoryFormValues = z.output<typeof categorySchema>;
export type CategoryFormInput = z.input<typeof categorySchema>;

const monthlyLimitField = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z
    .coerce.number()
    .positive({ error: "Лимит должен быть больше нуля." })
    .max(100_000_000, { error: "Слишком большая сумма." })
    .nullable(),
);

export const createCategorySchema = categorySchema.extend({
  kind: z.enum(["expense", "income"]),
  // Личный лимит создателя категории; персональные лимиты остальных
  // добавляются потом в списке категорий, каждым для себя.
  monthlyLimit: monthlyLimitField,
});

export type CreateCategoryFormValues = z.output<typeof createCategorySchema>;
export type CreateCategoryFormInput = z.input<typeof createCategorySchema>;

// Лимит категории для текущего пользователя (кто именно — определяется на
// сервере по активной сессии, не передаётся с клиента).
export const categoryLimitSchema = z.object({
  monthlyLimit: monthlyLimitField,
});

export type CategoryLimitFormValues = z.output<typeof categoryLimitSchema>;
export type CategoryLimitFormInput = z.input<typeof categoryLimitSchema>;

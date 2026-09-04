import { z } from "zod";

export const paymentMethodSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Введите название." })
    .max(100, { error: "Слишком длинное название." }),
});

export type PaymentMethodFormValues = z.output<typeof paymentMethodSchema>;
export type PaymentMethodFormInput = z.input<typeof paymentMethodSchema>;

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import {
  paymentMethodSchema,
  type PaymentMethodFormValues,
} from "@/lib/validations/payment-method";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createPaymentMethod(
  input: PaymentMethodFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = paymentMethodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте поля формы.",
    };
  }

  const [row] = await db
    .insert(paymentMethods)
    .values({ name: parsed.data.name })
    .returning({ id: paymentMethods.id });

  revalidatePath("/settings");

  return { success: true, data: { id: row.id } };
}

export async function setPaymentMethodArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  await db
    .update(paymentMethods)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(paymentMethods.id, id));

  revalidatePath("/settings");

  return { success: true, data: undefined };
}

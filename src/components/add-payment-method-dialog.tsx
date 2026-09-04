"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createPaymentMethod } from "@/app/actions/payment-methods";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  paymentMethodSchema,
  type PaymentMethodFormInput,
  type PaymentMethodFormValues,
} from "@/lib/validations/payment-method";

export function AddPaymentMethodDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<PaymentMethodFormInput, unknown, PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: { name: "" },
  });

  function handleSubmit(values: PaymentMethodFormValues) {
    startTransition(async () => {
      const result = await createPaymentMethod(values);
      if (!result.success) {
        form.setError("root", { message: result.error });
        return;
      }
      toast.success("Способ оплаты добавлен");
      form.reset({ name: "" });
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon />
        Добавить способ оплаты
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Новый способ оплаты</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="payment-method-name">Название</FieldLabel>
                <Input id="payment-method-name" autoFocus {...form.register("name")} />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>

              {form.formState.errors.root && (
                <FieldError>{form.formState.errors.root.message}</FieldError>
              )}

              <Button type="submit" disabled={isPending} className="w-full">
                Добавить способ оплаты
              </Button>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

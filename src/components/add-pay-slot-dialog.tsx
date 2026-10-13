"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createPaySlot } from "@/app/actions/payday";
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
  paySlotSchema,
  type PaySlotFormInput,
  type PaySlotFormValues,
} from "@/lib/validations/payday";

const EMPTY_VALUES = { label: "", dayOfMonth: "" };

export function AddPaySlotDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<PaySlotFormInput, unknown, PaySlotFormValues>({
    resolver: zodResolver(paySlotSchema),
    defaultValues: EMPTY_VALUES,
  });

  function handleSubmit(values: PaySlotFormValues) {
    startTransition(async () => {
      const result = await createPaySlot(values);
      if (!result.success) {
        form.setError("root", { message: result.error });
        return;
      }
      toast.success("Выплата добавлена");
      form.reset(EMPTY_VALUES);
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon />
        Добавить выплату
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Новая выплата</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.label}>
                <FieldLabel htmlFor="pay-slot-label">Название</FieldLabel>
                <Input
                  id="pay-slot-label"
                  placeholder="Аванс, Зарплата…"
                  autoFocus
                  {...form.register("label")}
                />
                <FieldError errors={[form.formState.errors.label]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.dayOfMonth}>
                <FieldLabel htmlFor="pay-slot-day">Число месяца</FieldLabel>
                <Input
                  id="pay-slot-day"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  placeholder="10"
                  {...form.register("dayOfMonth")}
                />
                <FieldError errors={[form.formState.errors.dayOfMonth]} />
              </Field>

              {form.formState.errors.root && (
                <FieldError>{form.formState.errors.root.message}</FieldError>
              )}

              <Button type="submit" disabled={isPending} className="w-full">
                Добавить выплату
              </Button>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

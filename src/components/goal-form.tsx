"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";

import type { ActionResult } from "@/app/actions/goals";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  goalSchema,
  type GoalFormInput,
  type GoalFormValues,
} from "@/lib/validations/goal";

function formatDateLabel(isoDate: string | null): string {
  if (!isoDate) return "Без срока";
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toIsoDate(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

export function GoalForm<TData = undefined>({
  mode,
  defaultValues,
  onSubmit,
  onSuccess,
}: {
  mode: "create" | "edit";
  defaultValues: GoalFormInput;
  onSubmit: (values: GoalFormValues) => Promise<ActionResult<TData>>;
  onSuccess?: (result: ActionResult<TData>) => void;
}) {
  const form = useForm<GoalFormInput, unknown, GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();

  const deadline = form.watch("deadline");

  function handleSubmit(values: GoalFormValues) {
    startTransition(async () => {
      const result = await onSubmit(values);
      if (!result.success) {
        form.setError("root", { message: result.error });
        return;
      }
      form.clearErrors("root");
      onSuccess?.(result);
    });
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={!!form.formState.errors.title}>
          <FieldLabel htmlFor="title">Название</FieldLabel>
          <Input
            id="title"
            autoFocus
            placeholder="Например, отпуск"
            {...form.register("title")}
          />
          <FieldError errors={[form.formState.errors.title]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.targetAmount}>
          <FieldLabel htmlFor="targetAmount">Сколько нужно</FieldLabel>
          <Input
            id="targetAmount"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0"
            onFocus={(event) => event.target.select()}
            {...form.register("targetAmount")}
          />
          <FieldError errors={[form.formState.errors.targetAmount]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.savedAmount}>
          <FieldLabel htmlFor="savedAmount">Сколько уже отложено</FieldLabel>
          <Input
            id="savedAmount"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0"
            onFocus={(event) => event.target.select()}
            {...form.register("savedAmount")}
          />
          <FieldError errors={[form.formState.errors.savedAmount]} />
        </Field>

        <Field>
          <FieldLabel>Срок</FieldLabel>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 justify-start"
                  >
                    <CalendarIcon className="size-4" />
                    {formatDateLabel(deadline)}
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deadline ? new Date(`${deadline}T00:00:00`) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      form.setValue("deadline", toIsoDate(date), {
                        shouldValidate: true,
                      });
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
            {deadline && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => form.setValue("deadline", null)}
              >
                Убрать
              </Button>
            )}
          </div>
        </Field>

        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {mode === "create" ? "Добавить цель" : "Сохранить изменения"}
        </Button>
      </FieldGroup>
    </form>
  );
}

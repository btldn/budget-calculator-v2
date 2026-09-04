"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { CalendarIcon } from "lucide-react";

import type { ActionResult } from "@/app/actions/transactions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CategoryOption } from "@/lib/queries/categories";
import {
  transactionSchema,
  type TransactionFormInput,
  type TransactionFormValues,
} from "@/lib/validations/transaction";

const NO_PAYMENT_METHOD = "none";
const NO_GOAL = "none";
const PRIMARY_CATEGORY_COUNT = 6;

function formatDateLabel(isoDate: string): string {
  if (!isoDate) return "Выберите дату";
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

export type UserOption = { id: string; displayName: string };
export type PaymentMethodOption = { id: string; name: string };
export type GoalOption = {
  id: string;
  title: string;
  targetAmount: string;
  savedAmount: string;
};

export function TransactionForm<TData = undefined>({
  mode,
  defaultValues,
  categories,
  users,
  paymentMethods,
  goals,
  onSubmit,
  onSuccess,
}: {
  mode: "create" | "edit";
  defaultValues: TransactionFormInput;
  categories: { expense: CategoryOption[]; income: CategoryOption[] };
  users: UserOption[];
  paymentMethods: PaymentMethodOption[];
  goals: GoalOption[];
  onSubmit: (values: TransactionFormValues) => Promise<ActionResult<TData>>;
  onSuccess?: (result: ActionResult<TData>) => void;
}) {
  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();
  const [showAllCategories, setShowAllCategories] = useState(false);

  const kind = form.watch("kind");
  const categoryId = form.watch("categoryId");
  const scope = form.watch("scope");
  const paidByUserId = form.watch("paidByUserId");
  const occurredOn = form.watch("occurredOn");
  const paymentMethodId = form.watch("paymentMethodId");
  const goalId = form.watch("goalId");
  const activeCategories = kind === "expense" ? categories.expense : categories.income;
  const primaryCategories = activeCategories.slice(0, PRIMARY_CATEGORY_COUNT);
  const restCategories = activeCategories.slice(PRIMARY_CATEGORY_COUNT);
  const isSelectedInRest = restCategories.some((c) => c.id === categoryId);
  const visibleCategories = showAllCategories || isSelectedInRest
    ? activeCategories
    : primaryCategories;

  function handleEnterSubmit(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void form.handleSubmit(handleSubmit)();
  }

  function handleSubmit(values: TransactionFormValues) {
    startTransition(async () => {
      const result = await onSubmit(values);
      if (!result.success) {
        form.setError("root", { message: result.error });
        return;
      }
      form.clearErrors("root");
      onSuccess?.(result);
      if (mode === "create") {
        form.reset({
          ...values,
          amount: 0,
          categoryId: "",
          goalId: null,
          note: "",
        });
        setShowAllCategories(false);
      }
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex flex-col gap-4"
    >
      <FieldGroup>
        <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
          <Button
            type="button"
            size="sm"
            variant={kind === "expense" ? "secondary" : "ghost"}
            onClick={() =>
              form.setValue("kind", "expense", { shouldValidate: true })
            }
          >
            Расход
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "income" ? "secondary" : "ghost"}
            onClick={() => {
              form.setValue("kind", "income", { shouldValidate: true });
              form.setValue("goalId", null);
            }}
          >
            Доход
          </Button>
        </div>

        <Field data-invalid={!!form.formState.errors.amount}>
          <FieldLabel htmlFor="amount">Сумма</FieldLabel>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            autoFocus
            placeholder="0"
            onFocus={(event) => event.target.select()}
            onKeyDown={handleEnterSubmit}
            {...form.register("amount")}
          />
          <FieldError errors={[form.formState.errors.amount]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.categoryId}>
          <FieldLabel>Категория</FieldLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleCategories.map((category) => (
              <Button
                key={category.id}
                type="button"
                variant={categoryId === category.id ? "secondary" : "outline"}
                size="sm"
                className="h-auto min-h-8 justify-start px-2 py-1.5 text-xs whitespace-normal"
                onClick={() =>
                  form.setValue("categoryId", category.id, {
                    shouldValidate: true,
                  })
                }
              >
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-left">{category.name}</span>
              </Button>
            ))}
          </div>
          {restCategories.length > 0 && !isSelectedInRest && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowAllCategories((prev) => !prev)}
            >
              {showAllCategories
                ? "Свернуть"
                : `Ещё ${restCategories.length}`}
            </Button>
          )}
          <FieldError errors={[form.formState.errors.categoryId]} />
        </Field>

        <Field>
          <FieldLabel>Дата</FieldLabel>
          <Popover>
            <PopoverTrigger
              render={
                <Button type="button" variant="outline" className="justify-start">
                  <CalendarIcon className="size-4" />
                  {formatDateLabel(occurredOn)}
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={occurredOn ? new Date(`${occurredOn}T00:00:00`) : undefined}
                onSelect={(date) => {
                  if (date) {
                    form.setValue("occurredOn", toIsoDate(date), {
                      shouldValidate: true,
                    });
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </Field>

        <Field>
          <FieldLabel>Чьё</FieldLabel>
          <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
            <Button
              type="button"
              size="sm"
              variant={scope === "shared" ? "secondary" : "ghost"}
              onClick={() => form.setValue("scope", "shared")}
            >
              Общее
            </Button>
            <Button
              type="button"
              size="sm"
              variant={scope === "personal" ? "secondary" : "ghost"}
              onClick={() => form.setValue("scope", "personal")}
            >
              Личное
            </Button>
          </div>
        </Field>

        <Field>
          <FieldLabel>Кто платил</FieldLabel>
          <div
            className={cn(
              "grid gap-1 rounded-lg border p-1",
              users.length === 2 ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            {users.map((user) => (
              <Button
                key={user.id}
                type="button"
                size="sm"
                variant={paidByUserId === user.id ? "secondary" : "ghost"}
                onClick={() => form.setValue("paidByUserId", user.id)}
              >
                {user.displayName}
              </Button>
            ))}
          </div>
        </Field>

        <Field>
          <FieldLabel>Способ оплаты</FieldLabel>
          <Select
            items={{
              [NO_PAYMENT_METHOD]: "Не указан",
              ...Object.fromEntries(paymentMethods.map((m) => [m.id, m.name])),
            }}
            value={paymentMethodId ?? NO_PAYMENT_METHOD}
            onValueChange={(value) =>
              form.setValue(
                "paymentMethodId",
                value === NO_PAYMENT_METHOD ? null : (value as string),
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Не указан" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PAYMENT_METHOD}>Не указан</SelectItem>
              {paymentMethods.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  {method.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {kind === "expense" && goals.length > 0 && (
          <Field>
            <FieldLabel>Цель</FieldLabel>
            <Select
              items={{
                [NO_GOAL]: "Без цели",
                ...Object.fromEntries(goals.map((g) => [g.id, g.title])),
              }}
              value={goalId ?? NO_GOAL}
              onValueChange={(value) =>
                form.setValue(
                  "goalId",
                  value === NO_GOAL ? null : (value as string),
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Без цели" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GOAL}>Без цели</SelectItem>
                {goals.map((goal) => {
                  const percent = Number(goal.targetAmount) > 0
                    ? Math.min(100, Math.round((Number(goal.savedAmount) / Number(goal.targetAmount)) * 100))
                    : 0;
                  return (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title} ({percent}%)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="note">Комментарий</FieldLabel>
          <Input
            id="note"
            placeholder="Необязательно"
            onKeyDown={handleEnterSubmit}
            {...form.register("note")}
          />
        </Field>

        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {mode === "create" ? "Сохранить трату" : "Сохранить изменения"}
        </Button>
      </FieldGroup>
    </form>
  );
}

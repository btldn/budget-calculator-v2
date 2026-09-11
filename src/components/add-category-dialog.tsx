"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createCategory } from "@/app/actions/categories";
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
  createCategorySchema,
  type CreateCategoryFormInput,
  type CreateCategoryFormValues,
} from "@/lib/validations/category";

export function AddCategoryDialog({ kind }: { kind: "expense" | "income" }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<CreateCategoryFormInput, unknown, CreateCategoryFormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "", color: "#3b82f6", monthlyLimit: null, kind },
  });

  function handleSubmit(values: CreateCategoryFormValues) {
    startTransition(async () => {
      const result = await createCategory(values);
      if (!result.success) {
        form.setError("root", { message: result.error });
        return;
      }
      toast.success("Категория добавлена");
      form.reset({ name: "", color: "#3b82f6", monthlyLimit: null, kind });
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon />
        Добавить категорию
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Новая категория</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="category-name">Название</FieldLabel>
                <Input id="category-name" autoFocus {...form.register("name")} />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="category-color">Цвет</FieldLabel>
                <input
                  id="category-color"
                  type="color"
                  {...form.register("color")}
                  className="h-9 w-16 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              </Field>

              {kind === "expense" && (
                <Field data-invalid={!!form.formState.errors.monthlyLimit}>
                  <FieldLabel htmlFor="category-limit">Мой лимит в месяц</FieldLabel>
                  <Input
                    id="category-limit"
                    type="number"
                    inputMode="decimal"
                    placeholder="Без лимита"
                    {...form.register("monthlyLimit")}
                  />
                  <FieldError errors={[form.formState.errors.monthlyLimit]} />
                </Field>
              )}

              {form.formState.errors.root && (
                <FieldError>{form.formState.errors.root.message}</FieldError>
              )}

              <Button type="submit" disabled={isPending} className="w-full">
                Добавить категорию
              </Button>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

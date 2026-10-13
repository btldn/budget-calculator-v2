"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  setCategoryArchived,
  setCategoryLimit,
  setCategoryPaySlot,
  updateCategory,
} from "@/app/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SettingsCategory } from "@/lib/queries/categories";
import type { PaySlot } from "@/lib/queries/payday";
import { cn } from "@/lib/utils";

const SPLIT_EVENLY = "evenly";

export function CategorySettingsRow({
  category,
  paySlots = [],
  onLimitSaved,
}: {
  category: SettingsCategory;
  paySlots?: PaySlot[];
  // Список переставляет категории с лимитом наверх, поэтому ему нужно знать,
  // когда лимит реально сохранился.
  onLimitSaved?: (categoryId: string, monthlyLimit: string | null) => void;
}) {
  const isArchived = !!category.archivedAt;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled: isArchived });
  const [name, setName] = useState(category.name);
  const [limit, setLimit] = useState(category.monthlyLimit ?? "");
  // Список категорий держит свои строки в state и после ревалидации не
  // обновляется, поэтому выбранная выплата живёт здесь, а не в пропсе.
  const [payScheduleId, setPayScheduleId] = useState(category.payScheduleId);
  const [isPending, startTransition] = useTransition();
  const showPayControl = category.kind === "expense" && paySlots.length >= 2 && !isArchived;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function saveName() {
    if (name === category.name) return;
    startTransition(async () => {
      const result = await updateCategory(category.id, { name, color: category.color });
      if (!result.success) toast.error(result.error);
    });
  }

  function saveColor(color: string) {
    startTransition(async () => {
      const result = await updateCategory(category.id, { name, color });
      if (!result.success) toast.error(result.error);
    });
  }

  function saveLimit(value: string) {
    if (value === (category.monthlyLimit ?? "")) return;
    // Без лимита строка в БД удаляется вместе с закреплением за выплатой.
    if (!value) setPayScheduleId(null);
    startTransition(async () => {
      const result = await setCategoryLimit(category.id, { monthlyLimit: value || null });
      if (!result.success) toast.error(result.error);
      else onLimitSaved?.(category.id, value || null);
    });
  }

  function savePaySlot(value: string) {
    const next = value === SPLIT_EVENLY ? null : value;
    if (next === payScheduleId) return;
    const previous = payScheduleId;
    setPayScheduleId(next);
    startTransition(async () => {
      const result = await setCategoryPaySlot(category.id, next);
      if (!result.success) {
        toast.error(result.error);
        setPayScheduleId(previous);
      }
    });
  }

  function toggleArchived() {
    startTransition(async () => {
      const result = await setCategoryArchived(category.id, !isArchived);
      if (!result.success) toast.error(result.error);
      else toast.success(isArchived ? "Категория восстановлена" : "Категория архивирована");
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5",
        isDragging && "z-10 bg-muted",
        isArchived && "opacity-60",
      )}
    >
      {!isArchived && (
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>
      )}

      <input
        type="color"
        value={category.color}
        disabled={isArchived}
        onChange={(event) => saveColor(event.target.value)}
        className="size-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
      />

      <Input
        value={name}
        disabled={isArchived}
        onChange={(event) => setName(event.target.value)}
        onBlur={saveName}
        className="h-8 min-w-[112px] flex-1"
      />

      {category.kind === "expense" && (
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Без лимита"
          value={limit}
          disabled={isArchived}
          onChange={(event) => setLimit(event.target.value)}
          onBlur={(event) => saveLimit(event.target.value)}
          className="h-8 w-32 shrink-0"
        />
      )}

      {/* Закрепить имеет смысл, только если выплат больше одной и лимит уже есть.
          Без лимита держим пустое место такой же ширины, чтобы поля лимита
          во всех строках стояли в одну колонку. */}
      {showPayControl &&
        (limit === "" ? (
          <div aria-hidden className="h-8 w-36 shrink-0" />
        ) : (
          <Select
            items={{
              [SPLIT_EVENLY]: "Поровну",
              ...Object.fromEntries(paySlots.map((slot) => [slot.id, `Из: ${slot.label}`])),
            }}
            value={payScheduleId ?? SPLIT_EVENLY}
            onValueChange={(value) => savePaySlot(value as string)}
          >
            <SelectTrigger size="sm" className="w-36 shrink-0" disabled={isPending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SPLIT_EVENLY}>Поровну</SelectItem>
              {paySlots.map((slot) => (
                <SelectItem key={slot.id} value={slot.id}>
                  Из: {slot.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={toggleArchived}
      >
        {isArchived ? "Восстановить" : "Архивировать"}
      </Button>
    </div>
  );
}

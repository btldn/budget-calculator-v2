"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  setCategoryArchived,
  setCategoryLimit,
  updateCategory,
} from "@/app/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SettingsCategory } from "@/lib/queries/categories";
import { cn } from "@/lib/utils";

export function CategorySettingsRow({ category }: { category: SettingsCategory }) {
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
  const [isPending, startTransition] = useTransition();

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
    startTransition(async () => {
      const result = await setCategoryLimit(category.id, { monthlyLimit: value || null });
      if (!result.success) toast.error(result.error);
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

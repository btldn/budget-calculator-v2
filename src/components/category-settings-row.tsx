"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setCategoryArchived, updateCategory } from "@/app/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SettingsCategory = {
  id: string;
  name: string;
  color: string;
  kind: "expense" | "income";
  monthlyLimit: string | null;
  archivedAt: Date | null;
};

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

  function saveField(patch: { name?: string; monthlyLimit?: string | null }) {
    startTransition(async () => {
      const result = await updateCategory(category.id, {
        name: patch.name ?? name,
        color: category.color,
        monthlyLimit:
          patch.monthlyLimit !== undefined
            ? patch.monthlyLimit
              ? Number(patch.monthlyLimit)
              : null
            : limit
              ? Number(limit)
              : null,
      });
      if (!result.success) toast.error(result.error);
    });
  }

  function saveColor(color: string) {
    startTransition(async () => {
      const result = await updateCategory(category.id, {
        name,
        color,
        monthlyLimit: limit ? Number(limit) : null,
      });
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
        onBlur={() => name !== category.name && saveField({ name })}
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
          onBlur={() =>
            limit !== (category.monthlyLimit ?? "") &&
            saveField({ monthlyLimit: limit || null })
          }
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

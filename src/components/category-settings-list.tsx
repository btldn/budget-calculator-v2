"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { toast } from "sonner";

import { reorderCategories } from "@/app/actions/categories";
import { AddCategoryDialog } from "@/components/add-category-dialog";
import { CategorySettingsRow } from "@/components/category-settings-row";
import { hasLimit, limitedFirst } from "@/lib/category-order";
import type { SettingsCategory } from "@/lib/queries/categories";
import type { PaySlot } from "@/lib/queries/payday";

export function CategorySettingsList({
  kind,
  active,
  archived,
  paySlots,
}: {
  kind: "expense" | "income";
  active: SettingsCategory[];
  archived: SettingsCategory[];
  paySlots?: PaySlot[];
}) {
  const [items, setItems] = useState(active);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function persistOrder(next: SettingsCategory[], previous: SettingsCategory[]) {
    reorderCategories(next.map((c) => c.id)).then((result) => {
      if (!result.success) {
        toast.error(result.error);
        setItems(previous);
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active: draggedItem, over } = event;
    if (!over || draggedItem.id === over.id) return;

    const oldIndex = items.findIndex((c) => c.id === draggedItem.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    // Категории с лимитом всегда выше остальных, поэтому через границу групп
    // не переставляем — после обновления страницы порядок всё равно вернулся бы.
    if (hasLimit(items[oldIndex]) !== hasLimit(items[newIndex])) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    persistOrder(reordered, items);
  }

  // Поставили или сняли лимит — категория переезжает в свою группу. Новый порядок
  // сохраняем, иначе после обновления страницы она встала бы по старому sort_order.
  function handleLimitSaved(categoryId: string, monthlyLimit: string | null) {
    const updated = items
      .map((c) => (c.id === categoryId ? { ...c, monthlyLimit } : c))
      .sort(limitedFirst);
    setItems(updated);
    if (updated.some((c, index) => c.id !== items[index].id)) persistOrder(updated, items);
  }

  return (
    <div className="space-y-2">
      <DndContext
        id={`category-list-${kind}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {items.map((category) => (
              <CategorySettingsRow
                key={category.id}
                category={category}
                paySlots={paySlots}
                onLimitSaved={handleLimitSaved}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <AddCategoryDialog kind={kind} />

      {archived.length > 0 && (
        <details className="pt-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Архивные ({archived.length})
          </summary>
          <div className="mt-2 space-y-1">
            {archived.map((category) => (
              <CategorySettingsRow key={category.id} category={category} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

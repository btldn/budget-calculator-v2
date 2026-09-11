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
import type { SettingsCategory } from "@/lib/queries/categories";

export function CategorySettingsList({
  kind,
  active,
  archived,
}: {
  kind: "expense" | "income";
  active: SettingsCategory[];
  archived: SettingsCategory[];
}) {
  const [items, setItems] = useState(active);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active: draggedItem, over } = event;
    if (!over || draggedItem.id === over.id) return;

    const oldIndex = items.findIndex((c) => c.id === draggedItem.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    reorderCategories(reordered.map((c) => c.id)).then((result) => {
      if (!result.success) {
        toast.error(result.error);
        setItems(items);
      }
    });
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
              <CategorySettingsRow key={category.id} category={category} />
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

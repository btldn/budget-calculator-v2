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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { reorderGoals } from "@/app/actions/goals";
import { cn } from "@/lib/utils";

// Карточки рендерятся на сервере (форматирование денег там), сюда приходят
// готовыми узлами — клиентский список отвечает только за порядок.
export type GoalListItem = { id: string; card: ReactNode };

function SortableGoal({ item, rank }: { item: GoalListItem; rank: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-80")}
    >
      {item.card}
      <button
        type="button"
        aria-label={`Приоритет ${rank}. Перетащите, чтобы изменить порядок`}
        className="absolute bottom-3 right-3 flex cursor-grab touch-none items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-3.5" />
        <span className="tabular-nums">№{rank}</span>
      </button>
    </div>
  );
}

export function GoalList({ items }: { items: GoalListItem[] }) {
  const [order, setOrder] = useState(() => items.map((item) => item.id));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const previous = order;
    const next = arrayMove(
      order,
      order.indexOf(String(active.id)),
      order.indexOf(String(over.id)),
    );
    setOrder(next);

    reorderGoals(next).then((result) => {
      if (!result.success) {
        toast.error(result.error);
        setOrder(previous);
      }
    });
  }

  return (
    <DndContext
      id="goal-list"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((item, index) => (
            <SortableGoal key={item.id} item={item} rank={index + 1} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

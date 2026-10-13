"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deletePaySlot, updatePaySlot } from "@/app/actions/payday";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PaySlot } from "@/lib/queries/payday";

export function PayScheduleSettingsRow({ slot }: { slot: PaySlot }) {
  const [label, setLabel] = useState(slot.label);
  const [day, setDay] = useState(String(slot.dayOfMonth));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    const dayOfMonth = Number(day);
    const unchanged = label === slot.label && dayOfMonth === slot.dayOfMonth;
    if (unchanged) return;

    startTransition(async () => {
      const result = await updatePaySlot(slot.id, { label, dayOfMonth });
      if (!result.success) {
        toast.error(result.error);
        // Вернуть в полях то, что реально лежит в БД, чтобы не показывать
        // несохранённое значение как сохранённое.
        setLabel(slot.label);
        setDay(String(slot.dayOfMonth));
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePaySlot(slot.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Выплата удалена");
      setConfirmOpen(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5">
      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={save}
        className="h-8 min-w-[112px] flex-1"
      />
      <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={day}
          onChange={(event) => setDay(event.target.value)}
          onBlur={save}
          className="h-8 w-16"
        />
        числа
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => setConfirmOpen(true)}
      >
        Удалить
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить выплату «{slot.label}»?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Уже внесённые зарплаты останутся. Категории, закреплённые за этой выплатой,
            снова будут делиться поровну.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteGoal, updateGoal } from "@/app/actions/goals";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoalForm } from "@/components/goal-form";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

type EditableGoal = {
  id: string;
  title: string;
  targetAmount: string;
  savedAmount: string;
  deadline: string | null;
};

export function GoalRowActions({ goal }: { goal: EditableGoal }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const isDesktop = useMediaQuery("(min-width: 640px)");

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteGoal(goal.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Цель удалена");
      setConfirmOpen(false);
    });
  }

  const editForm = (
    <GoalForm
      mode="edit"
      defaultValues={{
        title: goal.title,
        targetAmount: Number(goal.targetAmount),
        savedAmount: Number(goal.savedAmount),
        deadline: goal.deadline,
      }}
      onSubmit={(values) => updateGoal(goal.id, values)}
      onSuccess={(result) => {
        if (!result.success) return;
        toast.success("Изменения сохранены");
        setEditOpen(false);
      }}
    />
  );

  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
        Изменить
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
        Удалить
      </Button>

      {isDesktop ? (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Изменить цель</DialogTitle>
            </DialogHeader>
            {editForm}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Изменить цель</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">{editForm}</div>
          </SheetContent>
        </Sheet>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить цель?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Это действие нельзя отменить.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

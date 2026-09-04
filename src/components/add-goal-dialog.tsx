"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createGoal } from "@/app/actions/goals";
import { GoalForm } from "@/components/goal-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

export function AddGoalDialog() {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const form = (
    <GoalForm
      mode="create"
      defaultValues={{ title: "", targetAmount: 0, savedAmount: 0, deadline: null }}
      onSubmit={createGoal}
      onSuccess={(result) => {
        if (!result.success) return;
        toast.success("Цель добавлена");
        setOpen(false);
      }}
    />
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Добавить цель
      </Button>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Новая цель</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Новая цель</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">{form}</div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

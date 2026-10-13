"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useEditTransaction } from "@/components/add-transaction-provider";
import { deleteTransaction } from "@/app/actions/transactions";
import type { EditableTransaction } from "@/components/transaction-wizard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TransactionRowActions({
  transaction,
}: {
  transaction: EditableTransaction;
}) {
  const edit = useEditTransaction();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteTransaction(transaction.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Операция удалена");
      setConfirmOpen(false);
    });
  }

  return (
    <div className="flex justify-end gap-1">
      {edit && (
        <Button variant="ghost" size="sm" onClick={() => edit(transaction)}>
          Изменить
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
        Удалить
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить операцию?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Это действие нельзя отменить.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

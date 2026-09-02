"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTransaction, updateTransaction } from "@/app/actions/transactions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  TransactionForm,
  type PaymentMethodOption,
  type UserOption,
} from "@/components/transaction-form";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { CategoryOption } from "@/lib/queries/categories";

type EditableTransaction = {
  id: string;
  occurredOn: string;
  kind: "expense" | "income";
  amount: string;
  categoryId: string;
  scope: "shared" | "personal";
  paidByUserId: string;
  paymentMethodId: string | null;
  note: string | null;
};

export function TransactionRowActions({
  transaction,
  categories,
  users,
  paymentMethods,
}: {
  transaction: EditableTransaction;
  categories: { expense: CategoryOption[]; income: CategoryOption[] };
  users: UserOption[];
  paymentMethods: PaymentMethodOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const isDesktop = useMediaQuery("(min-width: 640px)");

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

  const editForm = (
    <TransactionForm
      mode="edit"
      categories={categories}
      users={users}
      paymentMethods={paymentMethods}
      defaultValues={{
        kind: transaction.kind,
        amount: Number(transaction.amount),
        occurredOn: transaction.occurredOn,
        categoryId: transaction.categoryId,
        scope: transaction.scope,
        paidByUserId: transaction.paidByUserId,
        paymentMethodId: transaction.paymentMethodId,
        note: transaction.note ?? "",
      }}
      onSubmit={(values) => updateTransaction(transaction.id, values)}
      onSuccess={(result) => {
        if (!result.success) return;
        toast.success("Изменения сохранены");
        setEditOpen(false);
      }}
    />
  );

  return (
    <div className="flex justify-end gap-1">
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
              <DialogTitle>Изменить операцию</DialogTitle>
            </DialogHeader>
            {editForm}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Изменить операцию</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">{editForm}</div>
          </SheetContent>
        </Sheet>
      )}

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

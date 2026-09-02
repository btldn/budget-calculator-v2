"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createTransaction, deleteTransaction } from "@/app/actions/transactions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { todayIsoClient } from "@/lib/format-client";

export function AddTransactionTrigger({
  categories,
  users,
  paymentMethods,
  currentUserId,
}: {
  categories: { expense: CategoryOption[]; income: CategoryOption[] };
  users: UserOption[];
  paymentMethods: PaymentMethodOption[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const form = (
    <TransactionForm<{ id: string }>
      mode="create"
      categories={categories}
      users={users}
      paymentMethods={paymentMethods}
      defaultValues={{
        kind: "expense",
        amount: 0,
        occurredOn: todayIsoClient(),
        categoryId: "",
        scope: "shared",
        paidByUserId: currentUserId,
        paymentMethodId: null,
        note: "",
      }}
      onSubmit={createTransaction}
      onSuccess={(result) => {
        if (!result.success) return;
        const id = result.data.id;
        toast.success("Трата сохранена", {
          action: {
            label: "Отменить",
            onClick: () => {
              void deleteTransaction(id);
            },
          },
        });
      }}
    />
  );

  return (
    <>
      <Button size="sm" className="hidden sm:inline-flex" onClick={() => setOpen(true)}>
        <PlusIcon />
        Добавить трату
      </Button>
      <Button
        size="icon-lg"
        className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg sm:hidden"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        <span className="sr-only">Добавить трату</span>
      </Button>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Новая операция</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Новая операция</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">{form}</div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

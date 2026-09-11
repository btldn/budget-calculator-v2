"use client";

import { createContext, useContext, useState } from "react";
import { toast } from "sonner";

import { createTransaction, deleteTransaction } from "@/app/actions/transactions";
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
  type GoalOption,
  type PaymentMethodOption,
  type UserOption,
} from "@/components/transaction-form";
import { useMediaQuery } from "@/hooks/use-media-query";
import { todayIsoClient } from "@/lib/format-client";
import type { CategoryOption } from "@/lib/queries/categories";

type AddTransactionContextValue = {
  open: () => void;
};

const AddTransactionContext = createContext<AddTransactionContextValue | null>(
  null,
);

export function useAddTransactionDialog(): AddTransactionContextValue {
  const ctx = useContext(AddTransactionContext);
  if (!ctx) {
    throw new Error(
      "useAddTransactionDialog должен вызываться внутри AddTransactionProvider",
    );
  }
  return ctx;
}

export function AddTransactionProvider({
  categories,
  users,
  paymentMethods,
  goals,
  currentUserId,
  children,
}: {
  categories: { expense: CategoryOption[]; income: CategoryOption[] };
  users: UserOption[];
  paymentMethods: PaymentMethodOption[];
  goals: GoalOption[];
  currentUserId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const form = (
    <TransactionForm<{ id: string }>
      mode="create"
      categories={categories}
      users={users}
      paymentMethods={paymentMethods}
      goals={goals}
      defaultValues={{
        kind: "expense",
        amount: 0,
        occurredOn: todayIsoClient(),
        categoryId: null,
        scope: "shared",
        paidByUserId: currentUserId,
        paymentMethodId: null,
        goalId: null,
        note: "",
      }}
      onSubmit={createTransaction}
      onSuccess={(result) => {
        if (!result.success) return;
        const id = result.data.id;
        setOpen(false);
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
    <AddTransactionContext.Provider value={{ open: () => setOpen(true) }}>
      {children}

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
    </AddTransactionContext.Provider>
  );
}

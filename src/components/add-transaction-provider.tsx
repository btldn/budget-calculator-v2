"use client";

import { createContext, useContext, useState } from "react";
import { toast } from "sonner";

import { fetchSpendContext } from "@/app/actions/payday";
import { deleteTransaction } from "@/app/actions/transactions";
import {
  TransactionWizard,
  type EditableTransaction,
  type GoalOption,
  type PaymentMethodOption,
  type UserOption,
} from "@/components/transaction-wizard";
import { WizardModal } from "@/components/wizard-frame";
import { useWizardSession } from "@/hooks/use-wizard-session";
import type { MoneyFormat } from "@/lib/format-client";
import type { CategoryOption } from "@/lib/queries/categories";

type AddTransactionContextValue = {
  open: () => void;
  // Отдельный метод, а не параметр у open: тот передают прямо в onClick, и вместо
  // категории он получил бы событие клика.
  openForCategory: (categoryId: string) => void;
  edit: (transaction: EditableTransaction) => void;
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

// Провайдера нет, пока не выбран пользователь, — тогда править операции нельзя,
// но страницы, где они показаны (история), всё равно должны открываться.
export function useEditTransaction(): AddTransactionContextValue["edit"] | null {
  return useContext(AddTransactionContext)?.edit ?? null;
}

export function AddTransactionProvider({
  categories,
  users,
  paymentMethods,
  goals,
  currentUserId,
  moneyFormat,
  children,
}: {
  categories: { expense: CategoryOption[]; income: CategoryOption[] };
  users: UserOption[];
  paymentMethods: PaymentMethodOption[];
  goals: GoalOption[];
  currentUserId: string;
  moneyFormat: MoneyFormat;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Правимая операция сохраняется и после закрытия окна — иначе на время
  // анимации закрытия оно перерисовалось бы как «новая операция».
  const [editing, setEditing] = useState<EditableTransaction | null>(null);
  const [editSession, setEditSession] = useState(0);
  // Категория, с которой открыли окно (клик по плашке на дашборде).
  const [presetCategoryId, setPresetCategoryId] = useState<string | null>(null);
  const { data: spend, sessionKey, start } = useWizardSession(fetchSpendContext);

  function openDialog(categoryId: string | null = null) {
    setEditing(null);
    setPresetCategoryId(categoryId);
    setOpen(true);
    // Остатки по категориям подтягиваются в фоне: окно открывается сразу, а
    // подписи на плитках появляются, когда ответ дошёл.
    start();
  }

  function editTransaction(transaction: EditableTransaction) {
    setEditing(transaction);
    // Каждое открытие — чистый мастер; остатки при правке не нужны.
    setEditSession((count) => count + 1);
    setOpen(true);
  }

  function handleSaved({ id, message }: { id: string; message: string }) {
    setOpen(false);
    if (editing) {
      toast.success(message);
      return;
    }
    toast.success(message, {
      action: {
        label: "Отменить",
        onClick: () => {
          void deleteTransaction(id);
        },
      },
    });
  }

  return (
    <AddTransactionContext.Provider
      value={{
        open: () => openDialog(),
        openForCategory: openDialog,
        edit: editTransaction,
      }}
    >
      {children}

      <WizardModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Изменить операцию" : "Новая операция"}
      >
        <TransactionWizard
          key={editing ? `edit-${editSession}` : sessionKey}
          categories={categories}
          users={users}
          paymentMethods={paymentMethods}
          goals={goals}
          currentUserId={currentUserId}
          moneyFormat={moneyFormat}
          spend={editing ? null : spend}
          presetCategoryId={editing ? undefined : (presetCategoryId ?? undefined)}
          existing={editing ?? undefined}
          onSaved={handleSaved}
        />
      </WizardModal>
    </AddTransactionContext.Provider>
  );
}

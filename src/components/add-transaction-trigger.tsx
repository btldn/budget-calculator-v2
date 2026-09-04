"use client";

import { PlusIcon } from "lucide-react";

import { useAddTransactionDialog } from "@/components/add-transaction-provider";
import { Button } from "@/components/ui/button";

export function AddTransactionTrigger() {
  const { open } = useAddTransactionDialog();

  return (
    <Button
      className="hidden h-9 rounded-xl px-5 font-semibold sm:inline-flex"
      onClick={open}
    >
      <PlusIcon />
      Добавить трату
    </Button>
  );
}

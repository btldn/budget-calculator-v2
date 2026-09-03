"use client";

import { PlusIcon } from "lucide-react";

import { useAddTransactionDialog } from "@/components/add-transaction-provider";
import { Button } from "@/components/ui/button";

export function AddTransactionTrigger() {
  const { open } = useAddTransactionDialog();

  return (
    <>
      <Button size="sm" className="hidden sm:inline-flex" onClick={open}>
        <PlusIcon />
        Добавить трату
      </Button>
      <Button
        size="icon-lg"
        className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg sm:hidden"
        onClick={open}
      >
        <PlusIcon />
        <span className="sr-only">Добавить трату</span>
      </Button>
    </>
  );
}

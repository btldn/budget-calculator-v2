"use client";

import { useAddTransactionDialog } from "@/components/add-transaction-provider";
import { Button } from "@/components/ui/button";

export function DashboardEmptyState({ message }: { message: string }) {
  const { open } = useAddTransactionDialog();

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-10 text-center">
      <p className="text-muted-foreground">{message}</p>
      <Button size="sm" onClick={open}>
        Добавить первую
      </Button>
    </div>
  );
}

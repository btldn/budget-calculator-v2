"use client";

import { useAddTransactionDialog } from "@/components/add-transaction-provider";
import { Button } from "@/components/ui/button";

export function DashboardEmptyState({ message }: { message: string }) {
  const { open } = useAddTransactionDialog();

  return (
    <div className="flex flex-col items-start gap-2 py-6">
      <p className="text-muted-foreground">{message}</p>
      <Button size="sm" onClick={open}>
        Добавить первую
      </Button>
    </div>
  );
}

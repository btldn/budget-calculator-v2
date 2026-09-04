"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setPaymentMethodArchived } from "@/app/actions/payment-methods";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PaymentMethodSettingsRow({
  method,
}: {
  method: { id: string; name: string; archivedAt: Date | null };
}) {
  const isArchived = !!method.archivedAt;
  const [isPending, startTransition] = useTransition();

  function toggleArchived() {
    startTransition(async () => {
      const result = await setPaymentMethodArchived(method.id, !isArchived);
      if (!result.success) toast.error(result.error);
      else toast.success(isArchived ? "Способ оплаты восстановлен" : "Способ оплаты архивирован");
    });
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5",
        isArchived && "opacity-60",
      )}
    >
      <span className="text-sm">{method.name}</span>
      <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={toggleArchived}>
        {isArchived ? "Восстановить" : "Архивировать"}
      </Button>
    </div>
  );
}

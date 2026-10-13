"use client";

import { ArrowRightIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { applyAllocationDrift } from "@/app/actions/payday";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { makeMoneyFormatter, type MoneyFormat } from "@/lib/format-client";
import type { AllocationDrift } from "@/lib/queries/payday";

// Кнопка «Обновить раскладку»: показывает, как изменится раскладка выплаты по
// категориям, и применяет только после подтверждения.
export function ReallocateButton({
  drift,
  moneyFormat,
}: {
  drift: AllocationDrift;
  moneyFormat: MoneyFormat;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const formatMoney = makeMoneyFormatter(moneyFormat);

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await applyAllocationDrift(drift.paycheckId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success("Раскладка обновлена");
    });
  }

  const content = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Деньги этой зарплаты на категории разделятся заново по сегодняшним лимитам. Цели и запас на
        жизнь останутся как есть.
      </p>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {drift.changes.map((change) => (
          <li key={change.categoryId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="min-w-0 truncate">
              {change.name}
              {change.before === 0 && (
                <span className="ml-1.5 text-[12px] text-muted-foreground">новая</span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
              <span className="text-muted-foreground">{formatMoney(change.before)}</span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{formatMoney(change.after)}</span>
            </span>
          </li>
        ))}
      </ul>

      {error && <FieldError>{error}</FieldError>}

      <Button type="button" className="h-11 w-full" disabled={isPending} onClick={apply}>
        Применить
      </Button>
    </div>
  );

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Обновить раскладку
      </Button>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Обновить раскладку</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Обновить раскладку</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">{content}</div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

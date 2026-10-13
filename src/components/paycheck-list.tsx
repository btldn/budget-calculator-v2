"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deletePaycheck } from "@/app/actions/payday";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { makeMoneyFormatter, type MoneyFormat } from "@/lib/format-client";
import type { PaycheckHistoryRow } from "@/lib/queries/payday";

function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PaycheckList({
  paychecks,
  moneyFormat,
}: {
  paychecks: PaycheckHistoryRow[];
  moneyFormat: MoneyFormat;
}) {
  const formatMoney = makeMoneyFormatter(moneyFormat);
  const [target, setTarget] = useState<PaycheckHistoryRow | null>(null);
  const [isPending, startTransition] = useTransition();

  if (paychecks.length === 0) {
    return (
      <p className="px-2 text-sm text-muted-foreground">
        Зарплат ещё не вносили. Кнопка «Пришла зарплата» — на дашборде.
      </p>
    );
  }

  function handleRollback() {
    if (!target) return;
    const id = target.id;
    startTransition(async () => {
      const result = await deletePaycheck(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Зарплата откачена");
      setTarget(null);
    });
  }

  return (
    <div className="divide-y divide-border">
      {paychecks.map((paycheck) => (
        <div key={paycheck.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="font-medium tabular-nums">{formatMoney(paycheck.amount)}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {paycheck.isExtra ? "Внеплановая" : (paycheck.slotLabel ?? "Зарплата")} ·{" "}
              {formatDay(paycheck.receivedOn)}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setTarget(paycheck)}>
            Откатить
          </Button>
        </div>
      ))}

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Откатить эту зарплату?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Доход и всё, что с неё отложено на цели, будет удалено, а накопленное по целям
            уменьшится на эти суммы. Траты, которые вы вносили после, останутся.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleRollback}>
              Откатить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

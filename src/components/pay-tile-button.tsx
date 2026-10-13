"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTransaction, payCategory } from "@/app/actions/transactions";
import { AmountField } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { makeMoneyFormatter, todayIsoClient, type MoneyFormat } from "@/lib/format-client";

// Кнопка «Заплатил» на плашке обязательного платежа. Сумма подставляется по
// остатку, но её можно поправить: реальная коммуналка редко совпадает с лимитом.
export function PayTileButton({
  categoryId,
  name,
  remaining,
  moneyFormat,
}: {
  categoryId: string;
  name: string;
  remaining: number;
  moneyFormat: MoneyFormat;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const formatMoney = makeMoneyFormatter(moneyFormat);

  function openDialog() {
    setAmount(String(Math.round(remaining * 100) / 100));
    setError(null);
    setOpen(true);
  }

  function submit() {
    const value = Number(amount);
    if (!(value > 0)) {
      setError("Введите сумму.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await payCategory({
        categoryId,
        amount: value,
        occurredOn: todayIsoClient(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }

      const id = result.data.id;
      setOpen(false);
      toast.success(`Оплачено: ${name}, ${formatMoney(value)}`, {
        action: {
          label: "Отменить",
          onClick: () => {
            void deleteTransaction(id);
          },
        },
      });
    });
  }

  const form = (
    <div className="space-y-4">
      <AmountField
        size="md"
        value={amount}
        onValueChange={setAmount}
        onEnter={submit}
        currency={moneyFormat.currency}
        aria-label="Сколько заплатили"
      />
      <p className="text-center text-[13px] text-muted-foreground">
        По плану осталось {formatMoney(remaining)}. Если заплатили другую сумму — поправьте.
      </p>
      {error && <FieldError>{error}</FieldError>}
      <Button type="button" className="h-11 w-full" disabled={isPending} onClick={submit}>
        Заплатил
      </Button>
    </div>
  );

  return (
    <>
      <Button type="button" variant="outline" size="xs" onClick={openDialog}>
        Заплатил
      </Button>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Заплатил: {name}</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Заплатил: {name}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">{form}</div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

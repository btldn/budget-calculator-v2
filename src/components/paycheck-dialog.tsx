"use client";

import {
  createContext,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { fetchPaydayContext } from "@/app/actions/payday";
import { PaycheckWizard } from "@/components/paycheck-wizard";
import { Button } from "@/components/ui/button";
import { WizardModal } from "@/components/wizard-frame";
import { useWizardSession } from "@/hooks/use-wizard-session";

const PaycheckDialogContext = createContext<{ open: () => void } | null>(null);

function usePaycheckDialog() {
  const ctx = useContext(PaycheckDialogContext);
  if (!ctx) {
    throw new Error("PaycheckButton должен вызываться внутри PaycheckProvider");
  }
  return ctx;
}

// Окно «Пришла зарплата» живёт здесь, а не в кнопке: после записи выплаты
// дашборд перерисовывается, кнопка в карточке заменяется на другую — и окно с
// финальным экраном пропало бы вместе с ней.
export function PaycheckProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: context, sessionKey, start } = useWizardSession(fetchPaydayContext);

  function openDialog() {
    setOpen(true);
    start();
  }

  const close = () => setOpen(false);

  const body = context ? (
    <PaycheckWizard key={sessionKey} context={context} onClose={close} />
  ) : (
    <p className="py-16 text-center text-sm text-muted-foreground">Загрузка…</p>
  );

  return (
    <PaycheckDialogContext.Provider value={{ open: openDialog }}>
      {children}

      <WizardModal open={open} onOpenChange={setOpen} title="Пришла зарплата">
        {body}
      </WizardModal>
    </PaycheckDialogContext.Provider>
  );
}

export function PaycheckButton({
  children,
  variant = "default",
  size = "default",
}: {
  children: ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
}) {
  const { open } = usePaycheckDialog();

  return (
    <Button type="button" variant={variant} size={size} onClick={open}>
      {children}
    </Button>
  );
}

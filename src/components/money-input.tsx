"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const NBSP = " ";

// В state лежит «сырая» строка вида "100000.5" (только цифры и одна точка),
// на экране — "100 000,5": тысячи разделены, чтобы большие суммы читались.
function sanitize(input: string, allowDecimals: boolean): string {
  let value = input.replace(/[\s ]/g, "").replace(",", ".");
  value = value.replace(allowDecimals ? /[^\d.]/g : /[^\d]/g, "");

  const [integer, ...rest] = value.split(".");
  const fraction = rest.join("").slice(0, 2);
  const cleanInteger = integer.replace(/^0+(?=\d)/, "");

  return allowDecimals && value.includes(".") ? `${cleanInteger}.${fraction}` : cleanInteger;
}

function display(raw: string): string {
  const [integer, fraction] = raw.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

const isSignificant = (char: string) => /[\d.,]/.test(char);

export function MoneyInput({
  value,
  onValueChange,
  allowDecimals = false,
  onEnter,
  ...props
}: {
  value: string;
  onValueChange: (value: string) => void;
  allowDecimals?: boolean;
  onEnter?: () => void;
} & Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode">) {
  const ref = useRef<HTMLInputElement>(null);
  // Сколько цифр и разделителей стояло левее курсора до переформатирования.
  const caret = useRef<number | null>(null);

  // Форматирование меняет длину текста, и курсор прыгал бы в конец при правке
  // посередине — возвращаем его на то же место среди цифр.
  useLayoutEffect(() => {
    const element = ref.current;
    const target = caret.current;
    caret.current = null;
    if (!element || target === null || document.activeElement !== element) return;

    let seen = 0;
    let position = 0;
    while (position < element.value.length && seen < target) {
      if (isSignificant(element.value[position])) seen += 1;
      position += 1;
    }
    element.setSelectionRange(position, position);
  });

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode={allowDecimals ? "decimal" : "numeric"}
      enterKeyHint={onEnter ? "next" : undefined}
      autoComplete="off"
      value={display(value)}
      onChange={(event) => {
        const element = event.target;
        const beforeCaret = element.value.slice(0, element.selectionStart ?? element.value.length);
        caret.current = [...beforeCaret].filter(isSignificant).length;
        onValueChange(sanitize(element.value, allowDecimals));
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (event.key === "Enter" && onEnter) {
          event.preventDefault();
          onEnter();
        }
      }}
    />
  );
}

const AMOUNT_FIELD_STYLES = {
  lg: {
    wrapper: "pt-2",
    input: "h-16 max-w-[240px] text-4xl md:text-4xl",
    currency: "text-2xl",
  },
  md: {
    wrapper: "",
    input: "h-14 max-w-[220px] text-3xl md:text-3xl",
    currency: "text-xl",
  },
};

// Крупное поле суммы с валютой справа: главный элемент шага или окна.
export function AmountField({
  size = "lg",
  currency,
  ...props
}: {
  size?: keyof typeof AMOUNT_FIELD_STYLES;
  currency: string;
} & Omit<ComponentProps<typeof MoneyInput>, "size" | "className" | "allowDecimals" | "autoFocus">) {
  const styles = AMOUNT_FIELD_STYLES[size];

  return (
    <div className={cn("flex items-baseline justify-center gap-2", styles.wrapper)}>
      <MoneyInput
        {...props}
        allowDecimals
        autoFocus
        className={cn(
          "rounded-none border-0 border-b-2 bg-transparent px-0 text-center font-semibold tabular-nums focus-visible:border-foreground focus-visible:ring-0 dark:bg-transparent",
          styles.input,
        )}
      />
      <span className={cn("text-muted-foreground", styles.currency)}>{currency}</span>
    </div>
  );
}

// Целые единицы валюты из сырой строки поля; мусор и минус превращаем в ноль.
export function parseUnits(raw: string): number {
  const parsed = Math.floor(Number(raw));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

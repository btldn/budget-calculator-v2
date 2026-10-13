"use client";

import { cn } from "@/lib/utils";

export type Chip = { value: string; label: string; hint?: string };

// Быстрый выбор одного из нескольких вариантов: видны все сразу, выбор — одно
// касание (в селекте — два). Для длинных списков берите Select.
export function ChipGroup({
  chips,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  chips: Chip[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((chip) => {
        const checked = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(chip.value)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-left text-sm leading-tight transition-colors",
              checked
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            <span className="font-medium">{chip.label}</span>
            {chip.hint && (
              <span className={cn("block text-[11.5px]", checked ? "opacity-70" : "text-muted-foreground")}>
                {chip.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

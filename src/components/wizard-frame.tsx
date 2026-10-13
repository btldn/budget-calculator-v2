"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

// Оболочка пошаговых окон: диалог на десктопе, шит почти на весь экран на
// телефоне. Высота фиксирована, чтобы шаги разной длины не «прыгали».
export function WizardModal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Для скринридера; видимый заголовок — у каждого шага свой.
  title: string;
  children: ReactNode;
}) {
  const isDesktop = useMediaQuery("(min-width: 640px)");

  return isDesktop ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(640px,90vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 overflow-hidden p-0 data-[side=bottom]:h-[92dvh]">
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

// При переходе на другой шаг фокус уходит на его заголовок — иначе клавиатура
// и скринридер остаются «в воздухе» на исчезнувшей кнопке.
export function useStepFocus(step: string) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (previous.current !== null && previous.current !== step) headingRef.current?.focus();
    previous.current = step;
  }, [step]);

  return headingRef;
}

export function WizardFrame({
  progress,
  title,
  titleIcon,
  headingRef,
  stepKey,
  direction,
  footer,
  children,
}: {
  // current — с нуля; при одном шаге индикатор не показываем.
  progress?: { current: number; total: number };
  title: ReactNode;
  titleIcon?: ReactNode;
  headingRef: RefObject<HTMLHeadingElement | null>;
  stepKey: string;
  direction: 1 | -1;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4 pr-12 pb-3">
        {progress && progress.total > 1 && (
          <div className="mb-3">
            <p className="text-[12px] text-muted-foreground">
              Шаг {progress.current + 1} из {progress.total}
            </p>
            <ol aria-hidden className="mt-1.5 flex gap-1.5">
              {Array.from({ length: progress.total }, (_, index) => (
                <li
                  key={index}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    index <= progress.current ? "bg-foreground" : "bg-muted",
                  )}
                />
              ))}
            </ol>
          </div>
        )}
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight outline-none"
        >
          {titleIcon}
          {title}
        </h3>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {/* Анимация только в ответ на действие человека: шаг сменился — слайд. */}
        <div
          key={stepKey}
          className={cn(
            "animate-in duration-200 fade-in-0 motion-reduce:animate-none",
            direction > 0 ? "slide-in-from-right-4" : "slide-in-from-left-4",
          )}
        >
          {children}
        </div>
      </div>

      <div className="border-t border-border bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {footer}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

// Одна полоска показывает, куда делась выплата: «жить», «копим», «свободно».
// Цвет только по смыслу: зелёный — цели, красный — распределено лишнее.
export function PaycheckSplitBar({
  totalCents,
  liveCents,
  saveCents,
  freeCents,
  isOver,
  formatMoney,
}: {
  totalCents: number;
  liveCents: number;
  saveCents: number;
  freeCents: number;
  isOver: boolean;
  formatMoney: (amount: number) => string;
}) {
  const share = (cents: number) =>
    totalCents > 0 ? Math.max(0, Math.min(100, (cents / totalCents) * 100)) : 0;

  const parts = [
    { label: "Жить", cents: liveCents, bar: "bg-foreground/80", dot: "bg-foreground/80" },
    { label: "Копим", cents: saveCents, bar: "bg-positive", dot: "bg-positive" },
    { label: "Свободно", cents: freeCents, bar: "bg-foreground/15", dot: "bg-foreground/25" },
  ];

  const summary = parts.map((part) => `${part.label} ${formatMoney(part.cents / 100)}`).join(", ");

  return (
    <div role="img" aria-label={isOver ? `Распределено больше, чем пришло. ${summary}` : summary}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {isOver ? (
          <div className="h-full w-full bg-destructive" />
        ) : (
          parts.map((part) => (
            <div
              key={part.label}
              className={cn("h-full transition-[width] duration-200", part.bar)}
              style={{ width: `${share(part.cents)}%` }}
            />
          ))
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-muted-foreground">
        {parts.map((part) => (
          <div key={part.label} className="min-w-0">
            <p className="flex items-center gap-1.5">
              <span className={cn("inline-block size-2 shrink-0 rounded-full", part.dot)} />
              {part.label}
            </p>
            <p className="tabular-nums text-foreground">{formatMoney(part.cents / 100)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

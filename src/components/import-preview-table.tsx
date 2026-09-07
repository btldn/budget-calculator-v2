"use client";

import type { PreviewRow } from "@/app/actions/import";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CategoryOption } from "@/lib/queries/categories";
import { cn } from "@/lib/utils";

const NO_CATEGORY = "none";

export type ImportRowState = {
  selected: boolean;
  categoryId: string | null;
  scope: "shared" | "personal";
  paidByUserId: string;
  remember: boolean;
};

export type UserOption = { id: string; displayName: string };

const DUPLICATE_LABELS: Record<NonNullable<PreviewRow["duplicate"]>, string> = {
  exact: "Уже импортировано",
  similar: "Похоже на дубль",
};

const DUPLICATE_HINTS: Record<NonNullable<PreviewRow["duplicate"]>, string> = {
  exact: "Такая операция уже есть в базе — она пришла с прошлой выпиской.",
  similar: "В этот день уже есть трата на ту же сумму. Проверьте, не задвоение ли это.",
};

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}.${month}`;
}

export function ImportPreviewTable({
  rows,
  state,
  categories,
  users,
  paymentMethodNames,
  formatMoney,
  onChange,
  onToggleAll,
}: {
  rows: PreviewRow[];
  state: Record<string, ImportRowState>;
  categories: { expense: CategoryOption[]; income: CategoryOption[] };
  users: UserOption[];
  paymentMethodNames: Map<string, string>;
  formatMoney: (amount: string | number) => string;
  onChange: (fingerprint: string, patch: Partial<ImportRowState>) => void;
  onToggleAll: (selected: boolean) => void;
}) {
  const selectedCount = rows.filter((row) => state[row.fingerprint]?.selected).length;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <input
              type="checkbox"
              aria-label="Выбрать все операции"
              className="size-4 accent-foreground"
              checked={selectedCount === rows.length}
              ref={(node) => {
                if (node) node.indeterminate = selectedCount > 0 && selectedCount < rows.length;
              }}
              onChange={(event) => onToggleAll(event.target.checked)}
            />
          </TableHead>
          <TableHead className="w-16">Дата</TableHead>
          <TableHead className="min-w-52">Операция</TableHead>
          <TableHead className="w-28 text-right">Сумма</TableHead>
          <TableHead className="w-52">Категория</TableHead>
          <TableHead className="w-24">Чьё</TableHead>
          <TableHead className="w-32">Кто платил</TableHead>
          <TableHead className="w-24">Способ</TableHead>
          <TableHead className="w-24">Запомнить</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => {
          const rowState = state[row.fingerprint];
          if (!rowState) return null;

          const options = categories[row.kind];
          const items = {
            [NO_CATEGORY]: "Не выбрана",
            ...Object.fromEntries(options.map((option) => [option.id, option.name])),
          };
          const needsCategory = rowState.selected && !rowState.categoryId;
          const paidBy = users.find((user) => user.id === rowState.paidByUserId);

          return (
            <TableRow
              key={row.fingerprint}
              className={cn(
                !rowState.selected && "opacity-50",
                needsCategory && "bg-destructive/5",
              )}
            >
              <TableCell>
                <input
                  type="checkbox"
                  aria-label={`Импортировать строку ${row.rowNumber}`}
                  className="size-4 accent-foreground"
                  checked={rowState.selected}
                  onChange={(event) =>
                    onChange(row.fingerprint, { selected: event.target.checked })
                  }
                />
              </TableCell>

              <TableCell className="whitespace-nowrap text-muted-foreground">
                {shortDate(row.occurredOn)}
                {row.time && <span className="block text-xs">{row.time}</span>}
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium" title={row.merchant}>
                    {row.merchantKey || row.description || "—"}
                  </span>
                  {row.pending && (
                    <Badge variant="outline" className="shrink-0">
                      В ожидании
                    </Badge>
                  )}
                  {row.duplicate && (
                    <Badge
                      variant="destructive"
                      className="shrink-0"
                      title={DUPLICATE_HINTS[row.duplicate]}
                    >
                      {DUPLICATE_LABELS[row.duplicate]}
                    </Badge>
                  )}
                </div>
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {row.description}
                </span>
              </TableCell>

              <TableCell
                className={cn(
                  "text-right font-medium whitespace-nowrap tabular-nums",
                  row.kind === "income" && "text-[oklch(0.6_0.15_150)]",
                )}
              >
                {row.kind === "expense" ? "−" : "+"}
                {formatMoney(row.amount)}
              </TableCell>

              <TableCell>
                <Select
                  items={items}
                  value={rowState.categoryId ?? NO_CATEGORY}
                  onValueChange={(value) => {
                    const categoryId = value === NO_CATEGORY ? null : (value as string);
                    // Запоминать нечего, пока категория не выбрана.
                    onChange(
                      row.fingerprint,
                      categoryId ? { categoryId } : { categoryId, remember: false },
                    );
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full"
                    aria-invalid={needsCategory || undefined}
                  >
                    <SelectValue placeholder="Не выбрана" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Не выбрана</SelectItem>
                    {options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>

              <TableCell>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm hover:bg-muted"
                  onClick={() =>
                    onChange(row.fingerprint, {
                      scope: rowState.scope === "shared" ? "personal" : "shared",
                    })
                  }
                >
                  {rowState.scope === "shared" ? "Общее" : "Личное"}
                </button>
              </TableCell>

              <TableCell>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm hover:bg-muted"
                  onClick={() => {
                    const index = users.findIndex((user) => user.id === rowState.paidByUserId);
                    const next = users[(index + 1) % users.length];
                    if (next) onChange(row.fingerprint, { paidByUserId: next.id });
                  }}
                >
                  {paidBy?.displayName ?? "—"}
                </button>
              </TableCell>

              <TableCell className="text-muted-foreground">
                {(row.paymentMethodId && paymentMethodNames.get(row.paymentMethodId)) ?? "—"}
              </TableCell>

              <TableCell>
                <input
                  type="checkbox"
                  aria-label={`Запомнить категорию для «${row.merchantKey}»`}
                  title={
                    rowState.categoryId
                      ? `Создать правило: «${row.merchantKey}» → выбранная категория`
                      : "Сначала выберите категорию"
                  }
                  className="size-4 accent-foreground"
                  disabled={!rowState.categoryId || !row.merchantKey}
                  checked={rowState.remember}
                  onChange={(event) =>
                    onChange(row.fingerprint, { remember: event.target.checked })
                  }
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { UnknownGroup } from "@/lib/import/group-unknown";
import type { CategoryOption } from "@/lib/queries/categories";

const NO_CATEGORY = "none";

export type UnknownGroupState = {
  categoryId: string | null;
  keyword: string;
  toDictionary: boolean;
};

export function ImportUnknownMerchants({
  groups,
  state,
  categories,
  formatMoney,
  onChange,
}: {
  groups: UnknownGroup[];
  state: Record<string, UnknownGroupState>;
  categories: { expense: CategoryOption[]; income: CategoryOption[] };
  formatMoney: (amount: string | number) => string;
  onChange: (id: string, patch: Partial<UnknownGroupState>) => void;
}) {
  const left = groups.filter((group) => !state[group.id]?.categoryId).length;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h2 className="font-medium">
            Новые источники{left > 0 && <span className="text-muted-foreground"> · осталось {left}</span>}
          </h2>
          <p className="text-sm text-muted-foreground">
            Правила их не узнали. Выберите категорию один раз — она проставится всем операциям
            этого источника, а ключевое слово попадёт в словарь и в следующий раз сработает само.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-52">Ключевое слово</TableHead>
              <TableHead className="w-24 text-right">Операций</TableHead>
              <TableHead className="w-28 text-right">Сумма</TableHead>
              <TableHead className="w-52">Категория</TableHead>
              <TableHead className="w-24">В словарь</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {groups.map((group) => {
              const groupState = state[group.id];
              if (!groupState) return null;

              const options = categories[group.kind];
              const items = {
                [NO_CATEGORY]: "Не выбрана",
                ...Object.fromEntries(options.map((option) => [option.id, option.name])),
              };
              const keywordTooShort = groupState.toDictionary && groupState.keyword.trim().length < 2;

              return (
                <TableRow key={group.id}>
                  <TableCell>
                    <Input
                      value={groupState.keyword}
                      aria-label={`Ключевое слово для «${group.sample}»`}
                      aria-invalid={keywordTooShort || undefined}
                      onChange={(event) => onChange(group.id, { keyword: event.target.value })}
                    />
                    <span className="mt-1 line-clamp-1 text-xs text-muted-foreground" title={group.sample}>
                      {group.sample}
                    </span>
                  </TableCell>

                  <TableCell className="text-right tabular-nums">{group.count}</TableCell>

                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {group.kind === "expense" ? "−" : "+"}
                    {formatMoney(group.total)}
                  </TableCell>

                  <TableCell>
                    <Select
                      items={items}
                      value={groupState.categoryId ?? NO_CATEGORY}
                      onValueChange={(value) =>
                        onChange(group.id, {
                          categoryId: value === NO_CATEGORY ? null : (value as string),
                        })
                      }
                    >
                      <SelectTrigger size="sm" className="w-full">
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
                    <input
                      type="checkbox"
                      aria-label={`Запомнить «${groupState.keyword}» в словаре`}
                      title="Разовую операцию — например, перевод конкретному человеку — в словарь класть не стоит"
                      className="size-4 accent-foreground"
                      checked={groupState.toDictionary}
                      onChange={(event) =>
                        onChange(group.id, { toDictionary: event.target.checked })
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

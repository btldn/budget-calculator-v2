"use client";

import { CalendarIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ANY = "any";

type Category = { id: string; name: string; color: string };
type User = { id: string; displayName: string };
type PaymentMethod = { id: string; name: string };

function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toIsoDate(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

export function HistoryFilters({
  categories,
  users,
  paymentMethods,
}: {
  categories: Category[];
  users: User[];
  paymentMethods: PaymentMethod[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const selectedCategoryIds = (searchParams.get("category") ?? "")
    .split(",")
    .filter(Boolean);
  const paidByUserId = searchParams.get("paidBy") ?? ANY;
  const scope = searchParams.get("scope") ?? ANY;
  const paymentMethodId = searchParams.get("method") ?? ANY;

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === ANY) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    const timeout = setTimeout(() => updateParams({ q: search || null }), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function toggleCategory(id: string) {
    const next = selectedCategoryIds.includes(id)
      ? selectedCategoryIds.filter((c) => c !== id)
      : [...selectedCategoryIds, id];
    updateParams({ category: next.length ? next.join(",") : null });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" size="sm">
              <CalendarIcon />
              {from ? formatShortDate(from) : "С даты"}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={from ? new Date(`${from}T00:00:00`) : undefined}
            onSelect={(date) => updateParams({ from: date ? toIsoDate(date) : null })}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" size="sm">
              <CalendarIcon />
              {to ? formatShortDate(to) : "По дату"}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={to ? new Date(`${to}T00:00:00`) : undefined}
            onSelect={(date) => updateParams({ to: date ? toIsoDate(date) : null })}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" size="sm">
              Категории
              {selectedCategoryIds.length > 0 && ` (${selectedCategoryIds.length})`}
            </Button>
          }
        />
        <PopoverContent className="w-64">
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {categories.map((category) => (
              <Button
                key={category.id}
                type="button"
                size="sm"
                variant={
                  selectedCategoryIds.includes(category.id) ? "secondary" : "ghost"
                }
                className="justify-start"
                onClick={() => toggleCategory(category.id)}
              >
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                {category.name}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Select
        items={{
          [ANY]: "Кто платил: все",
          ...Object.fromEntries(users.map((u) => [u.id, u.displayName])),
        }}
        value={paidByUserId}
        onValueChange={(value) => updateParams({ paidBy: value as string })}
      >
        <SelectTrigger size="sm">
          <SelectValue placeholder="Кто платил" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Кто платил: все</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={{ [ANY]: "Чьё: всё", shared: "Общее", personal: "Личное" }}
        value={scope}
        onValueChange={(value) => updateParams({ scope: value as string })}
      >
        <SelectTrigger size="sm">
          <SelectValue placeholder="Чьё" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Чьё: всё</SelectItem>
          <SelectItem value="shared">Общее</SelectItem>
          <SelectItem value="personal">Личное</SelectItem>
        </SelectContent>
      </Select>

      <Select
        items={{
          [ANY]: "Способ: любой",
          ...Object.fromEntries(paymentMethods.map((m) => [m.id, m.name])),
        }}
        value={paymentMethodId}
        onValueChange={(value) => updateParams({ method: value as string })}
      >
        <SelectTrigger size="sm">
          <SelectValue placeholder="Способ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Способ: любой</SelectItem>
          {paymentMethods.map((method) => (
            <SelectItem key={method.id} value={method.id}>
              {method.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Поиск по комментарию"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className={cn("w-full sm:w-48")}
      />
    </div>
  );
}

"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${year}`;
}

export function MonthSwitcher({ month }: { month: string }) {
  const currentYear = Number(month.split("-")[0]);
  const [pickerYear, setPickerYear] = useState(currentYear);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        className="size-8 rounded-[9px] border-none bg-card p-0"
        nativeButton={false}
        render={<Link href={`/?month=${prev}`} />}
      >
        <ChevronLeftIcon />
      </Button>

      <Popover
        onOpenChange={(isOpen) => {
          if (isOpen) setPickerYear(currentYear);
        }}
      >
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm">
              {monthLabel(month)}
            </Button>
          }
        />
        <PopoverContent className="w-64">
          <div className="mb-2 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setPickerYear((y) => y - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="text-sm font-medium">{pickerYear}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setPickerYear((y) => y + 1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_NAMES.map((name, index) => {
              const value = `${pickerYear}-${String(index + 1).padStart(2, "0")}`;
              const isActive = value === month;
              return (
                <Button
                  key={name}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/?month=${value}`} />}
                >
                  {name.slice(0, 3)}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        className="size-8 rounded-[9px] border-none bg-card p-0"
        nativeButton={false}
        render={<Link href={`/?month=${next}`} />}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

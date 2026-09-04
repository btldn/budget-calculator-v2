"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type DonutSlice = {
  id?: string;
  name: string;
  value: number;
  amountLabel: string;
  color: string;
};

export function ExpensesDonut({
  data,
  totalLabel,
}: {
  data: DonutSlice[];
  totalLabel: string;
}) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  const config = Object.fromEntries(
    data.map((slice) => [slice.name, { label: slice.name, color: slice.color }]),
  ) satisfies ChartConfig;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <ChartContainer config={config} className="aspect-square w-[200px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={3}
              strokeWidth={2}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(_, index) => {
                const slice = data[index];
                if (slice.id) router.push(`/history?category=${slice.id}`);
              }}
            >
              {data.map((slice, index) => (
                <Cell
                  key={slice.name}
                  fill={slice.color}
                  fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
                  className={cn("outline-none", slice.id && "cursor-pointer")}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Всего</span>
          <span className="text-xl font-semibold tabular-nums">{totalLabel}</span>
        </div>
      </div>

      <div className="w-full space-y-1">
        {data.map((slice, index) => {
          const percent = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <div
              key={slice.name}
              className={cn(
                "flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm transition-colors",
                slice.id && "cursor-pointer",
                activeIndex === index && "bg-muted",
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => slice.id && router.push(`/history?category=${slice.id}`)}
            >
              <span
                className="size-[9px] shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="min-w-0 flex-1 truncate">{slice.name}</span>
              <span className="text-muted-foreground tabular-nums">{percent}%</span>
              <span className="font-semibold tabular-nums">{slice.amountLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

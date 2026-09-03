"use client";

import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type DonutSlice = { name: string; value: number; color: string };

export function ExpensesDonut({
  data,
  totalLabel,
}: {
  data: DonutSlice[];
  totalLabel: string;
}) {
  const config = Object.fromEntries(
    data.map((slice) => [slice.name, { label: slice.name, color: slice.color }]),
  ) satisfies ChartConfig;

  return (
    <div className="relative mx-auto max-w-64">
      <ChartContainer config={config} className="mx-auto aspect-square max-h-64">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={90}
            strokeWidth={2}
          >
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground">Всего</span>
        <span className="text-lg font-semibold tabular-nums">{totalLabel}</span>
      </div>
    </div>
  );
}

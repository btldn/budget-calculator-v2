"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DailyExpense } from "@/lib/queries/dashboard";

const chartConfig = {
  amount: {
    label: "Расходы за день",
    color: "var(--chart-1)",
  },
  cumulative: {
    label: "Накопительный итог",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function ExpensesChart({
  data,
  monthlyLimit,
}: {
  data: DailyExpense[];
  monthlyLimit: number;
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <ComposedChart data={data} margin={{ left: -20 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} width={60} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(day) => `День ${day}`} />}
        />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={2} />
        <Line
          dataKey="cumulative"
          stroke="var(--color-cumulative)"
          strokeWidth={2}
          dot={false}
        />
        {monthlyLimit > 0 && (
          <ReferenceLine
            y={monthlyLimit}
            stroke="var(--destructive)"
            strokeDasharray="4 4"
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}

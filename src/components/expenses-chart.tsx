"use client";

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import type { DotItemDotProps } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DailyExpense } from "@/lib/queries/dashboard";

const chartConfig = {
  cumulative: {
    label: "Накопительный итог",
    color: "var(--chart-1)",
  },
  plan: {
    label: "План",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

function formatThousands(value: number): string {
  if (Math.abs(value) < 1000) return String(value);
  return `${Math.round(value / 1000)}к`;
}

export function ExpensesChart({
  data,
  monthlyLimit,
  currentDay,
}: {
  data: DailyExpense[];
  monthlyLimit: number;
  currentDay: number | null;
}) {
  const daysInMonth = data.length;
  const chartData = data.map((point) => ({
    ...point,
    plan: monthlyLimit > 0 ? (monthlyLimit * point.day) / daysInMonth : undefined,
    cumulative:
      currentDay !== null && point.day > currentDay ? null : point.cumulative,
  }));
  const lastActualIndex =
    (currentDay !== null ? Math.min(currentDay, daysInMonth) : daysInMonth) - 1;

  const xAxisTicks = Array.from(
    new Set([
      ...Array.from({ length: Math.ceil(daysInMonth / 5) }, (_, i) => i * 5 + 1),
      ...(currentDay !== null ? [currentDay] : []),
    ]),
  ).sort((a, b) => a - b);

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
      <AreaChart data={chartData} margin={{ top: 16, left: 8, right: 8 }}>
        <defs>
          <linearGradient id="fillCumulative" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          ticks={xAxisTicks}
          interval={0}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={40}
          tickFormatter={formatThousands}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(day) => `День ${day}`} />}
        />
        {monthlyLimit > 0 && (
          <Line
            dataKey="plan"
            stroke="var(--color-plan)"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            type="monotone"
            dot={(props: DotItemDotProps) => {
              if (props.index !== chartData.length - 1) return <g key={props.index} />;
              return (
                <text
                  key={props.index}
                  x={props.cx}
                  y={(props.cy ?? 0) - 10}
                  textAnchor="end"
                  fontSize={12}
                  fill="var(--color-plan)"
                >
                  план
                </text>
              );
            }}
            activeDot={false}
          />
        )}
        <Area
          dataKey="cumulative"
          stroke="var(--color-cumulative)"
          strokeWidth={2.5}
          type="monotone"
          fill="url(#fillCumulative)"
          dot={(props: DotItemDotProps) => {
            if (props.index !== lastActualIndex) return <g key={props.index} />;
            return (
              <circle
                key={props.index}
                cx={props.cx}
                cy={props.cy}
                r={4}
                fill="var(--color-cumulative)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            );
          }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

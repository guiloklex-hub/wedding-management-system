"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { CHART_PALETTE, CHART_TOOLTIP_STYLE } from "./chart-theme";

export type DonutDatum = { name: string; value: number; color?: string };

export function Donut({
  data,
  height = 280,
  innerRadius = 60,
  outerRadius = 95,
  valueFormatter,
  legend = true,
}: {
  data: DonutDatum[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  valueFormatter?: (n: number) => string;
  legend?: boolean;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-zinc-500">
        Sem dados suficientes
      </div>
    );
  }
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={data.length > 1 ? 4 : 0}
            dataKey="value"
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color ?? CHART_PALETTE[index % CHART_PALETTE.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              valueFormatter ? valueFormatter(Number(value ?? 0)) : Number(value ?? 0).toLocaleString("pt-BR")
            }
            contentStyle={CHART_TOOLTIP_STYLE}
            itemStyle={{ color: "#fff" }}
          />
          {legend ? (
            <Legend
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{ fontSize: "12px", color: "#a1a1aa", paddingTop: "12px" }}
            />
          ) : null}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

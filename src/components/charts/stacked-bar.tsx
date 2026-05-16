"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  CHART_AXIS_STROKE,
  CHART_AXIS_TEXT,
  CHART_GRID_STROKE,
  CHART_TOOLTIP_STYLE,
} from "./chart-theme";

export type StackSeries = { key: string; label: string; color: string };

export function StackedBar({
  data,
  series,
  height = 280,
  horizontal = false,
  valueFormatter,
}: {
  data: Array<Record<string, number | string>>;
  series: StackSeries[];
  height?: number;
  horizontal?: boolean;
  valueFormatter?: (n: number) => string;
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
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 16, left: horizontal ? 60 : 0, bottom: 4 }}
        >
          <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
          {horizontal ? (
            <>
              <XAxis type="number" stroke={CHART_AXIS_STROKE} tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }} />
              <YAxis dataKey="name" type="category" stroke={CHART_AXIS_STROKE} tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" stroke={CHART_AXIS_STROKE} tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }} />
              <YAxis stroke={CHART_AXIS_STROKE} tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }} />
            </>
          )}
          <Tooltip
            formatter={(value) =>
              valueFormatter ? valueFormatter(Number(value ?? 0)) : String(value ?? 0)
            }
            contentStyle={CHART_TOOLTIP_STYLE}
            itemStyle={{ color: "#fff" }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#a1a1aa", paddingTop: "8px" }}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} stackId="a" name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

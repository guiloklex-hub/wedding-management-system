"use client";

import {
  LineChart,
  Line,
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

export type BurndownPoint = {
  date: string;
  ideal: number;
  actual: number;
};

export function Burndown({ data, height = 280 }: { data: BurndownPoint[]; height?: number }) {
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
        <LineChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            stroke={CHART_AXIS_STROKE}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
            minTickGap={30}
          />
          <YAxis
            stroke={CHART_AXIS_STROKE}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            itemStyle={{ color: "#fff" }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa", paddingTop: "8px" }} />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#71717a"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            dot={false}
            name="Ideal"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#f43f5e"
            strokeWidth={2}
            dot={false}
            name="Real"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

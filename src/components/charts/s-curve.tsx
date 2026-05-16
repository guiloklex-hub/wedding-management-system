"use client";

import {
  ComposedChart,
  Area,
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

export type SCurvePoint = {
  date: string;
  plannedCum: number;
  paidCum: number;
  lowerBand: number;
  upperBand: number;
};

export function SCurve({
  data,
  height = 320,
  valueFormatter,
}: {
  data: SCurvePoint[];
  height?: number;
  valueFormatter?: (n: number) => string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-zinc-500">
        Sem dados suficientes
      </div>
    );
  }
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            stroke={CHART_AXIS_STROKE}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
            tickFormatter={(d: string) => {
              const dt = new Date(d);
              return `${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${String(dt.getUTCFullYear()).slice(2)}`;
            }}
            minTickGap={20}
          />
          <YAxis
            stroke={CHART_AXIS_STROKE}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
            tickFormatter={(v: number) => (valueFormatter ? valueFormatter(v) : String(v))}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            itemStyle={{ color: "#fff" }}
            formatter={(value, name) => [
              valueFormatter ? valueFormatter(Number(value ?? 0)) : String(value ?? 0),
              String(name),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa", paddingTop: "8px" }} />
          <Area
            type="monotone"
            dataKey="upperBand"
            stroke="transparent"
            fill="rgba(244, 63, 94, 0.08)"
            name="Banda contingência"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="lowerBand"
            stroke="transparent"
            fill="rgba(24, 24, 27, 1)"
            isAnimationActive={false}
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="plannedCum"
            stroke="#a1a1aa"
            strokeWidth={2}
            dot={false}
            name="Previsto"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="paidCum"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name="Realizado"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

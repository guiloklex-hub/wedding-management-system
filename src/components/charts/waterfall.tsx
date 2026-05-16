"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  CHART_AXIS_STROKE,
  CHART_AXIS_TEXT,
  CHART_GRID_STROKE,
  CHART_TOOLTIP_STYLE,
} from "./chart-theme";

export type WaterfallBar = {
  name: string;
  delta: number;
  positive: boolean;
};

export function Waterfall({
  data,
  height = 320,
  valueFormatter,
}: {
  data: WaterfallBar[];
  height?: number;
  valueFormatter?: (n: number) => string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-zinc-500">
        Sem variação significativa
      </div>
    );
  }
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 8, bottom: 48 }}
        >
          <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            stroke={CHART_AXIS_STROKE}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke={CHART_AXIS_STROKE}
            tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
            tickFormatter={(v: number) => (valueFormatter ? valueFormatter(v) : String(v))}
          />
          <Tooltip
            formatter={(v) => (valueFormatter ? valueFormatter(Number(v ?? 0)) : String(v ?? 0))}
            contentStyle={CHART_TOOLTIP_STYLE}
            itemStyle={{ color: "#fff" }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.name === "Total" ? "#a1a1aa" : d.positive ? "#f43f5e" : "#22c55e"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

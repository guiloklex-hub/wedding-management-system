"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

export type ChartDatum = {
  name: string;
  value: number;
  color?: string;
};

const FALLBACK_COLORS = [
  "#f43f5e",
  "#ec4899",
  "#d946ef",
  "#a855f7",
  "#8b5cf6",
  "#6366f1",
  "#3b82f6",
  "#14b8a6",
  "#f59e0b",
];

export default function DashboardCharts({ data }: { data: ChartDatum[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Sem dados suficientes para o gráfico
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius="55%" outerRadius="75%" paddingAngle={5} dataKey="value" stroke="none">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(Number(value ?? 0))}
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "12px",
                color: "#fff",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
              }}
              itemStyle={{ color: "#fff" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="custom-scrollbar mt-3 flex shrink-0 flex-wrap justify-center gap-x-3 gap-y-1.5 overflow-y-auto pr-1 text-xs text-zinc-400 max-h-[72px]">
        {data.map((entry, index) => (
          <li key={entry.name} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-sm"
              style={{ background: entry.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length] }}
            />
            <span className="break-words leading-tight">{entry.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

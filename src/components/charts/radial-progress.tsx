"use client";

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

export function RadialProgress({
  value,
  max = 1,
  label,
  sublabel,
  color = "#f43f5e",
  height = 180,
}: {
  value: number;
  max?: number;
  label: string;
  sublabel?: string;
  color?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(value, max));
  const pct = max > 0 ? clamped / max : 0;
  const data = [{ name: label, value: clamped }];

  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          barSize={14}
          data={data}
          startAngle={210}
          endAngle={-30}
        >
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
          <RadialBar background={{ fill: "rgba(255,255,255,0.06)" }} dataKey="value" cornerRadius={8} fill={color} isAnimationActive={false} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold text-zinc-100">{Math.round(pct * 100)}%</span>
        <span className="text-xs text-zinc-400">{label}</span>
        {sublabel ? <span className="mt-1 text-[10px] text-zinc-500">{sublabel}</span> : null}
      </div>
    </div>
  );
}

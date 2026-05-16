"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

type Point = { label: string; value: number };

export function Sparkline({
  data,
  stroke = "#f43f5e",
  height = 36,
}: {
  data: Point[];
  stroke?: string;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return <div className="h-9 w-full" />;
  }
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

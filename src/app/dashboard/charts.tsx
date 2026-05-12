'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#14b8a6', '#f59e0b'];

export default function DashboardCharts({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <div className="text-zinc-500 text-sm flex h-full items-center justify-center">Sem dados suficientes para o gráfico</div>;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={70}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#a1a1aa', paddingTop: '20px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

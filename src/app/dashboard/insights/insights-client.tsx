"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/format";
import type {
  CategoryCreep,
  HealthScoreResult,
  MonthlyPoint,
  PaymentHeatCell,
} from "@/lib/cashflow";

type Props = {
  eventDate: Date;
  contingencyPercent: number;
  totals: { budget: number; contracted: number; paid: number; cash: number };
  daysToEvent: number;
  cashflow: MonthlyPoint[];
  worstMonthlyBalance: number;
  health: HealthScoreResult;
  creep: CategoryCreep[];
  heatmap: PaymentHeatCell[];
};

export default function InsightsClient({
  eventDate,
  totals,
  daysToEvent,
  cashflow,
  worstMonthlyBalance,
  health,
  creep,
  heatmap,
}: Props) {
  return (
    <div className="space-y-6">
      <HealthCard health={health} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CashflowProjection cashflow={cashflow} worstBalance={worstMonthlyBalance} />
        <WaterfallChart cashflow={cashflow} />
      </div>

      <WhatIfSimulator totals={totals} cashflow={cashflow} eventDate={eventDate} />

      <CreepCard items={creep} />

      <HeatmapCard heatmap={heatmap} eventDate={eventDate} daysToEvent={daysToEvent} />
    </div>
  );
}

function HealthCard({ health }: { health: HealthScoreResult }) {
  const tone =
    health.score >= 75
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
      : health.score >= 50
        ? "border-amber-500/30 bg-amber-500/5 text-amber-100"
        : "border-rose-500/30 bg-rose-500/5 text-rose-200";

  return (
    <section className={`rounded-2xl border p-6 ${tone}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <ScoreGauge score={health.score} />
          <div>
            <p className="text-xs uppercase tracking-wider opacity-70">Health Score</p>
            <p className="text-3xl font-bold">{health.score}/100</p>
            <p className="mt-1 text-xs opacity-70">
              {health.score >= 75
                ? "Projeto saudável."
                : health.score >= 50
                  ? "Atenção em alguns pontos."
                  : "Precisa de ajustes urgentes."}
            </p>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-xs sm:max-w-md sm:grid-cols-2">
          {health.breakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between">
              <span className="opacity-70">{b.label}</span>
              <span className="font-semibold">{Math.round(b.normalized * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      {health.alerts.length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm">
          {health.alerts.map((a, i) => (
            <li key={i} className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const stroke = 8;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(score, 100)) / 100) * circumference;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#f43f5e";
  return (
    <svg width={96} height={96} viewBox="0 0 96 96">
      <circle cx={48} cy={48} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
      <circle
        cx={48}
        cy={48}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="none"
        transform="rotate(-90 48 48)"
      />
      <text x={48} y={52} textAnchor="middle" className="fill-current text-lg font-bold">
        {score}
      </text>
    </svg>
  );
}

function CashflowProjection({
  cashflow,
  worstBalance,
}: {
  cashflow: MonthlyPoint[];
  worstBalance: number;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-100">Fluxo de caixa projetado</h3>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            worstBalance >= 0
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          Pior saldo: {formatCurrency(worstBalance)}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Saldo cumulativo até o evento, considerando aportes existentes + receitas previstas −
        pagamentos pendentes.
      </p>
      <div className="mt-4 h-72 w-full">
        {cashflow.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">Sem dados ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cashflow}>
              <defs>
                <linearGradient id="cashflowFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="monthLabel" stroke="#71717a" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#71717a"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 12,
                  color: "#fff",
                }}
                formatter={(value, name) => [formatCurrency(Number(value)), labelForKey(String(name))]}
              />
              <Area
                type="monotone"
                dataKey="ending"
                stroke="#10b981"
                fill="url(#cashflowFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function WaterfallChart({ cashflow }: { cashflow: MonthlyPoint[] }) {
  const data = cashflow.map((c) => ({
    monthLabel: c.monthLabel,
    income: c.income,
    outflow: -c.outflow,
    ending: c.ending,
    isNegative: c.isNegative,
  }));

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-100">Entradas e saídas por mês</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Barras verdes = receitas. Barras vermelhas = pagamentos. Zona vermelha de fundo = saldo negativo projetado.
      </p>
      <div className="mt-4 h-72 w-full">
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">Sem dados ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="monthLabel" stroke="#71717a" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#71717a"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 12,
                  color: "#fff",
                }}
                formatter={(value, name) => [formatCurrency(Math.abs(Number(value))), labelForKey(String(name))]}
              />
              <Bar dataKey="income" stackId="flow" fill="#10b981" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill="#10b981" />
                ))}
              </Bar>
              <Bar dataKey="outflow" stackId="flow" fill="#f43f5e" radius={[0, 0, 4, 4]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.isNegative ? "#f43f5e" : "#fb7185"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function WhatIfSimulator({
  totals,
  cashflow,
  eventDate,
}: {
  totals: { budget: number; contracted: number; paid: number; cash: number };
  cashflow: MonthlyPoint[];
  eventDate: Date;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  const result = useMemo(() => {
    const n = Number(amount.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || !date) return null;
    const dt = new Date(date);
    if (Number.isNaN(dt.getTime())) return null;
    const targetKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    let running = totals.cash;
    let postBalance = totals.cash;
    let lowestAfter = Infinity;
    let monthHit: string | null = null;
    for (const m of cashflow) {
      const inflow = m.income;
      const outflow = m.outflow + (m.month === targetKey ? n : 0);
      running = running + inflow - outflow;
      if (m.month === targetKey) {
        postBalance = running;
        monthHit = m.monthLabel;
      }
      if (running < lowestAfter) lowestAfter = running;
    }
    const finalAfter = running;
    return { postBalance, lowestAfter, finalAfter, monthLabel: monthHit, amount: n };
  }, [amount, date, totals.cash, cashflow]);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-100">Posso fechar esse contrato agora?</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Simule adicionar um pagamento futuro e veja o impacto no fluxo de caixa até{" "}
        {formatDateBR(eventDate)}.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Input label="Valor (R$)" type="number" step="0.01" value={amount} onChange={setAmount} />
        <Input label="Data prevista" type="date" value={date} onChange={setDate} />
        <div className="flex items-end">
          {result ? (
            <ResultBadge tone={result.lowestAfter >= 0 ? "ok" : "bad"} />
          ) : (
            <span className="text-xs text-zinc-500">Preencha valor e data</span>
          )}
        </div>
      </div>

      {result ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label={`Saldo em ${result.monthLabel ?? "—"}`} value={formatCurrency(result.postBalance)} />
          <Stat
            label="Pior saldo até o evento"
            value={formatCurrency(result.lowestAfter)}
            accent={result.lowestAfter >= 0 ? "emerald" : "rose"}
          />
          <Stat
            label="Saldo final no evento"
            value={formatCurrency(result.finalAfter)}
            accent={result.finalAfter >= 0 ? "emerald" : "rose"}
          />
        </div>
      ) : null}
    </section>
  );
}

function ResultBadge({ tone }: { tone: "ok" | "bad" }) {
  if (tone === "ok")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
        <TrendingUp className="h-3 w-3" /> Pode fechar
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-300">
      <TrendingDown className="h-3 w-3" /> Estoura o caixa
    </span>
  );
}

function CreepCard({ items }: { items: CategoryCreep[] }) {
  if (items.length === 0) return null;
  const positives = items.filter((i) => i.delta > 0);
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-100">Variação por categoria</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Compara estimado vs contratado em cada categoria. Itens com aumento &gt; 10% precisam de atenção.
      </p>
      {positives.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Nenhuma categoria está acima do estimado.</p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {items.map((c) => {
          const tone =
            c.pct > 0.1
              ? "border-rose-500/30 bg-rose-500/5"
              : c.pct > 0
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-emerald-500/20 bg-emerald-500/5";
          return (
            <li key={c.category} className={`rounded-xl border p-3 ${tone}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="font-medium text-zinc-100">{c.category}</span>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    c.pct > 0.1
                      ? "text-rose-300"
                      : c.pct > 0
                        ? "text-amber-300"
                        : "text-emerald-300"
                  }`}
                >
                  {(c.pct * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                <span>Estimado: {formatCurrency(c.estimated)}</span>
                <span>Contratado: {formatCurrency(c.actual)}</span>
                <span className={c.delta > 0 ? "text-rose-300" : "text-emerald-300"}>
                  {c.delta > 0 ? "+" : ""}
                  {formatCurrency(c.delta)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HeatmapCard({
  heatmap,
  eventDate,
  daysToEvent,
}: {
  heatmap: PaymentHeatCell[];
  eventDate: Date;
  daysToEvent: number;
}) {
  if (heatmap.length === 0) return null;
  const maxAmount = Math.max(...heatmap.map((c) => c.amount), 0);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-100">Concentração de pagamentos pendentes</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Até {formatDateBR(eventDate)} ({daysToEvent} dias). Quanto mais intenso, mais concentrado o dia.
      </p>
      <div className="mt-4 flex flex-wrap gap-1">
        {heatmap.map((c) => {
          const intensity = maxAmount > 0 ? c.amount / maxAmount : 0;
          const alpha = 0.15 + intensity * 0.7;
          return (
            <div
              key={c.date}
              title={`${formatDateBR(c.date)} · ${formatCurrency(c.amount)} (${c.count} pagamento(s))`}
              className="h-7 w-7 rounded-md border border-zinc-800"
              style={{ background: `rgba(244, 63, 94, ${alpha})` }}
            />
          );
        })}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "rose" | "emerald";
}) {
  const accentClass =
    accent === "rose" ? "text-rose-300" : accent === "emerald" ? "text-emerald-300" : "text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-base font-semibold ${accentClass}`}>{value}</p>
    </div>
  );
}

function Input({
  label,
  type = "text",
  step,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  step?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

function labelForKey(k: string): string {
  if (k === "ending") return "Saldo final";
  if (k === "income") return "Receitas";
  if (k === "outflow") return "Pagamentos";
  return k;
}

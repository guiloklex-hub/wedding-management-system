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
import { useTranslations } from "next-intl";
import { AlertTriangle, Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/format";
import type {
  CategoryCreep,
  HealthScoreResult,
  MonthlyPoint,
  PaymentHeatCell,
  WaterfallBar,
} from "@/lib/cashflow";
import type { PaymentCurvePoint } from "@/lib/reports/payment-curve";
import type { BurndownPoint } from "@/lib/reports/task-burndown";
import { SCurve } from "@/components/charts/s-curve";
import { Burndown } from "@/components/charts/burndown";
import { Waterfall } from "@/components/charts/waterfall";
import { AiGenerateButton } from "@/components/ai/ai-generate-button";
import { generateInsightsNarrative } from "@/app/actions/aiActions";

type Props = {
  eventDate: Date;
  contingencyPercent: number;
  totals: { budget: number; contracted: number; paid: number; cash: number };
  daysToEvent: number;
  leftover: number;
  cashflow: MonthlyPoint[];
  worstMonthlyBalance: number;
  health: HealthScoreResult;
  creep: CategoryCreep[];
  heatmap: PaymentHeatCell[];
  sCurve: PaymentCurvePoint[];
  burndown: BurndownPoint[];
  waterfall: WaterfallBar[];
  aiEnabled: boolean;
};

export default function InsightsClient({
  eventDate,
  totals,
  daysToEvent,
  leftover,
  cashflow,
  worstMonthlyBalance,
  health,
  creep,
  heatmap,
  sCurve,
  burndown,
  waterfall,
  aiEnabled,
}: Props) {
  const t = useTranslations("dashboard.insights");
  return (
    <div className="space-y-6">
      <HealthCard health={health} />
      {aiEnabled ? <AiNarrativeCard /> : null}
      <LiquidityCard leftover={leftover} budget={totals.budget} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CashflowProjection cashflow={cashflow} worstBalance={worstMonthlyBalance} />
        <WaterfallChart cashflow={cashflow} />
      </div>

      <section
        id="scurve"
        className="scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">{t("sCurve.title")}</h2>
          <span className="text-xs text-zinc-500">{t("sCurve.hint")}</span>
        </div>
        <SCurve data={sCurve} valueFormatter={(n) => formatCurrency(n)} />
      </section>

      <section
        id="burndown"
        className="scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">{t("burndown.title")}</h2>
          <span className="text-xs text-zinc-500">{t("burndown.hint")}</span>
        </div>
        <Burndown data={burndown} />
      </section>

      <WhatIfSimulator totals={totals} cashflow={cashflow} eventDate={eventDate} />

      <section
        id="waterfall"
        className="scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">{t("waterfall.title")}</h2>
          <span className="text-xs text-zinc-500">{t("waterfall.hint")}</span>
        </div>
        <Waterfall data={waterfall} valueFormatter={(n) => formatCurrency(n)} />
      </section>

      <CreepCard items={creep} />

      <HeatmapCard heatmap={heatmap} eventDate={eventDate} daysToEvent={daysToEvent} />
    </div>
  );
}

function AiNarrativeCard() {
  const t = useTranslations("dashboard.insights.ai");
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">{t("title")}</h2>
      <p className="mb-4 mt-1 text-xs text-zinc-500">{t("description")}</p>
      <AiGenerateButton action={generateInsightsNarrative} namespace="dashboard.insights.ai" />
    </section>
  );
}

function HealthCard({ health }: { health: HealthScoreResult }) {
  const t = useTranslations("dashboard.insights");
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
            <p className="text-xs uppercase tracking-wider opacity-70">{t("health.label")}</p>
            <p className="text-3xl font-bold">{health.score}/100</p>
            <p className="mt-1 text-xs opacity-70">
              {health.score >= 75
                ? t("health.statusGood")
                : health.score >= 50
                  ? t("health.statusWarn")
                  : t("health.statusBad")}
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
      {health.recommendations.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-current/10 pt-3 text-sm">
          {health.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-amber-200">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t(r.key, r.params ?? {})}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function LiquidityCard({ leftover, budget }: { leftover: number; budget: number }) {
  const t = useTranslations("dashboard.insights");
  const healthyThreshold = budget * 0.1;
  const tone =
    leftover < 0
      ? { box: "border-rose-500/30 bg-rose-500/5 text-rose-200", status: t("liquidity.critical") }
      : leftover < healthyThreshold
        ? { box: "border-amber-500/30 bg-amber-500/5 text-amber-100", status: t("liquidity.warning") }
        : { box: "border-emerald-500/30 bg-emerald-500/5 text-emerald-200", status: t("liquidity.positive") };
  return (
    <section className={`rounded-2xl border p-6 ${tone.box}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider opacity-70">{t("liquidity.label")}</p>
          <p className="mt-1 text-3xl font-bold">{formatCurrency(leftover)}</p>
          <p className="mt-1 text-xs opacity-70">{tone.status}</p>
        </div>
        {leftover >= 0 ? (
          <TrendingUp className="h-8 w-8 shrink-0 opacity-80" />
        ) : (
          <TrendingDown className="h-8 w-8 shrink-0 opacity-80" />
        )}
      </div>
      <p className="mt-3 text-xs opacity-70">{t("liquidity.description")}</p>
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
  const t = useTranslations("dashboard.insights");
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-100">{t("cashflow.title")}</h3>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            worstBalance >= 0
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {t("cashflow.worstBalance", { value: formatCurrency(worstBalance) })}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{t("cashflow.description")}</p>
      <div className="mt-4 h-72 w-full">
        {cashflow.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">{t("noData")}</p>
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
                formatter={(value, name) => [
                  formatCurrency(Number(value)),
                  labelForKey(String(name), t),
                ]}
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
  const t = useTranslations("dashboard.insights");
  const data = cashflow.map((c) => ({
    monthLabel: c.monthLabel,
    income: c.income,
    outflow: -c.outflow,
    ending: c.ending,
    isNegative: c.isNegative,
  }));

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-100">{t("monthlyFlow.title")}</h3>
      <p className="mt-1 text-xs text-zinc-500">{t("monthlyFlow.description")}</p>
      <div className="mt-4 h-72 w-full">
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">{t("noData")}</p>
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
                formatter={(value, name) => [
                  formatCurrency(Math.abs(Number(value))),
                  labelForKey(String(name), t),
                ]}
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
  const t = useTranslations("dashboard.insights");
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
      <h3 className="text-lg font-semibold text-zinc-100">{t("whatIf.title")}</h3>
      <p className="mt-1 text-xs text-zinc-500">
        {t("whatIf.description", { date: formatDateBR(eventDate) })}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Input
          label={t("whatIf.amountLabel")}
          type="number"
          step="0.01"
          value={amount}
          onChange={setAmount}
        />
        <Input label={t("whatIf.dateLabel")} type="date" value={date} onChange={setDate} />
        <div className="flex items-end">
          {result ? (
            <ResultBadge tone={result.lowestAfter >= 0 ? "ok" : "bad"} />
          ) : (
            <span className="text-xs text-zinc-500">{t("whatIf.fillPrompt")}</span>
          )}
        </div>
      </div>

      {result ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat
            label={t("whatIf.balanceAt", { month: result.monthLabel ?? "—" })}
            value={formatCurrency(result.postBalance)}
          />
          <Stat
            label={t("whatIf.worstBalance")}
            value={formatCurrency(result.lowestAfter)}
            accent={result.lowestAfter >= 0 ? "emerald" : "rose"}
          />
          <Stat
            label={t("whatIf.finalBalance")}
            value={formatCurrency(result.finalAfter)}
            accent={result.finalAfter >= 0 ? "emerald" : "rose"}
          />
        </div>
      ) : null}
    </section>
  );
}

function ResultBadge({ tone }: { tone: "ok" | "bad" }) {
  const t = useTranslations("dashboard.insights");
  if (tone === "ok")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
        <TrendingUp className="h-3 w-3" /> {t("whatIf.canAfford")}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-300">
      <TrendingDown className="h-3 w-3" /> {t("whatIf.exceedsCash")}
    </span>
  );
}

function CreepCard({ items }: { items: CategoryCreep[] }) {
  const t = useTranslations("dashboard.insights");
  if (items.length === 0) return null;
  const positives = items.filter((i) => i.delta > 0);
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-100">{t("creep.title")}</h3>
      <p className="mt-1 text-xs text-zinc-500">{t("creep.description")}</p>
      {positives.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">{t("creep.allWithinBudget")}</p>
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
                <span>{t("creep.estimated", { value: formatCurrency(c.estimated) })}</span>
                <span>{t("creep.contracted", { value: formatCurrency(c.actual) })}</span>
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
  const t = useTranslations("dashboard.insights");
  if (heatmap.length === 0) return null;
  const maxAmount = Math.max(...heatmap.map((c) => c.amount), 0);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-100">{t("heatmap.title")}</h3>
      <p className="mt-1 text-xs text-zinc-500">
        {t("heatmap.description", { date: formatDateBR(eventDate), days: daysToEvent })}
      </p>
      <div className="mt-4 flex flex-wrap gap-1">
        {heatmap.map((c) => {
          const intensity = maxAmount > 0 ? c.amount / maxAmount : 0;
          const alpha = 0.15 + intensity * 0.7;
          return (
            <div
              key={c.date}
              title={t("heatmap.cellTitle", {
                date: formatDateBR(c.date),
                value: formatCurrency(c.amount),
                count: c.count,
              })}
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

function labelForKey(k: string, t: (key: string) => string): string {
  if (k === "ending") return t("chartLegend.ending");
  if (k === "income") return t("chartLegend.income");
  if (k === "outflow") return t("chartLegend.outflow");
  return k;
}

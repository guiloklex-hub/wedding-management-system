"use client";

import { Donut, type DonutDatum } from "@/components/charts/donut";
import { StackedBar, type StackSeries } from "@/components/charts/stacked-bar";
import type { GuestsAnalytics } from "@/lib/reports/guests-analytics";

const RSVP_COLORS: Record<string, string> = {
  CONFIRMED: "#22c55e",
  MAYBE: "#f59e0b",
  DECLINED: "#f43f5e",
  INVITED: "#71717a",
};

const STACK_SERIES: StackSeries[] = [
  { key: "CONFIRMED", label: "Confirmados", color: "#22c55e" },
  { key: "MAYBE", label: "Talvez", color: "#f59e0b" },
  { key: "INVITED", label: "Pendentes", color: "#71717a" },
  { key: "DECLINED", label: "Recusas", color: "#f43f5e" },
];

export function GuestsReportClient({ result }: { result: GuestsAnalytics }) {
  const donutData: DonutDatum[] = [
    { name: "Confirmados", value: result.byStatus.CONFIRMED, color: RSVP_COLORS.CONFIRMED },
    { name: "Talvez", value: result.byStatus.MAYBE, color: RSVP_COLORS.MAYBE },
    { name: "Recusas", value: result.byStatus.DECLINED, color: RSVP_COLORS.DECLINED },
    { name: "Pendentes", value: result.byStatus.INVITED, color: RSVP_COLORS.INVITED },
  ].filter((d) => d.value > 0);

  const groupData = result.byGroup.map((g) => ({
    name: g.groupName,
    CONFIRMED: g.counts.CONFIRMED,
    MAYBE: g.counts.MAYBE,
    INVITED: g.counts.INVITED,
    DECLINED: g.counts.DECLINED,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Tile label="Convidados" value={result.totalInvited} />
        <Tile label="Confirmados" value={result.totalConfirmed} color="text-emerald-400" />
        <Tile label="+ Acompanhantes" value={result.plusOnesConfirmed} color="text-violet-400" />
        <Tile label="Crianças" value={result.children} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Status do RSVP</h2>
          <Donut data={donutData} valueFormatter={(n) => `${n} pessoa(s)`} />
          <p className="mt-2 text-center text-xs text-zinc-500">
            Total efetivo (com +1s): <span className="font-semibold text-zinc-200">{result.effectiveConfirmed}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Por grupo</h2>
          {groupData.length > 0 ? (
            <StackedBar
              data={groupData}
              series={STACK_SERIES}
              horizontal
              height={Math.max(220, groupData.length * 36 + 60)}
            />
          ) : (
            <p className="text-sm text-zinc-500">Nenhum grupo de convidados cadastrado.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">VIPs & Padrinhos</h2>
          <div className="grid grid-cols-2 gap-4">
            <Tile label="VIPs confirmados" value={result.vipsConfirmed} color="text-amber-400" />
            <Tile label="Padrinhos confirmados" value={result.padrinhosConfirmed} color="text-violet-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Top cidades</h2>
          {result.byCity.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma cidade informada.</p>
          ) : (
            <ul className="space-y-2">
              {result.byCity.slice(0, 8).map((c) => (
                <li
                  key={c.city}
                  className="flex items-center justify-between border-b border-zinc-800 pb-2 text-sm"
                >
                  <span className="text-zinc-300">{c.city}</span>
                  <span className="font-semibold text-zinc-100">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  color = "text-zinc-100",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

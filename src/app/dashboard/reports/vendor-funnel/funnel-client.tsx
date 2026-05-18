"use client";

import { StackedBar, type StackSeries } from "@/components/charts/stacked-bar";
import type { VendorFunnelResult } from "@/lib/reports/vendor-funnel";

const SERIES: StackSeries[] = [
  { key: "NEGOTIATION", label: "Negociando", color: "#f59e0b" },
  { key: "CONTRACTED", label: "Contratado", color: "#8b5cf6" },
  { key: "FINALIZED", label: "Finalizado", color: "#22c55e" },
];

export function FunnelClient({ result }: { result: VendorFunnelResult }) {
  const barData = result.perCategory.map((c) => ({
    name: c.categoryLabel,
    NEGOTIATION: c.counts.NEGOTIATION,
    CONTRACTED: c.counts.CONTRACTED,
    FINALIZED: c.counts.FINALIZED,
  }));

  const totals = result.totals;
  const totalAll = totals.NEGOTIATION + totals.CONTRACTED + totals.FINALIZED;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Em negociação" value={totals.NEGOTIATION} color="text-amber-400" />
        <Tile label="Contratados" value={totals.CONTRACTED} color="text-violet-400" />
        <Tile label="Finalizados" value={totals.FINALIZED} color="text-emerald-400" />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Por categoria</h2>
          <span className="text-xs text-zinc-500">{totalAll} fornecedor(es)</span>
        </div>
        <StackedBar data={barData} series={SERIES} horizontal height={Math.max(260, barData.length * 36 + 80)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tile
          label="Tempo médio de negociação → contrato"
          value={result.avgDaysNegToContract ?? null}
          color="text-zinc-100"
          unit="dias"
        />
        <Tile
          label="Tempo médio de contrato → finalização"
          value={result.avgDaysContractToFinalized ?? null}
          color="text-zinc-100"
          unit="dias"
        />
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  color,
  unit,
}: {
  label: string;
  value: number | null;
  color: string;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
      <p className="text-sm text-zinc-400">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${color}`}>{value === null ? "—" : value}</span>
        {unit ? <span className="text-xs text-zinc-500">{unit}</span> : null}
      </div>
    </div>
  );
}

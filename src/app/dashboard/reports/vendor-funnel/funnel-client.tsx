"use client";

import { useTranslations } from "next-intl";
import { StackedBar, type StackSeries } from "@/components/charts/stacked-bar";
import type { VendorFunnelResult } from "@/lib/reports/vendor-funnel";

export function FunnelClient({ result }: { result: VendorFunnelResult }) {
  const t = useTranslations("dashboard.reports.vendorFunnel");

  const SERIES: StackSeries[] = [
    { key: "NEGOTIATION", label: t("series.negotiating"), color: "#f59e0b" },
    { key: "CONTRACTED", label: t("series.contracted"), color: "#8b5cf6" },
    { key: "FINALIZED", label: t("series.finalized"), color: "#22c55e" },
  ];

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
        <Tile label={t("tiles.negotiation")} value={totals.NEGOTIATION} color="text-amber-400" />
        <Tile label={t("tiles.contracted")} value={totals.CONTRACTED} color="text-violet-400" />
        <Tile label={t("tiles.finalized")} value={totals.FINALIZED} color="text-emerald-400" />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">{t("byCategory.title")}</h2>
          <span className="text-xs text-zinc-500">{t("byCategory.vendorCount", { count: totalAll })}</span>
        </div>
        <StackedBar data={barData} series={SERIES} horizontal height={Math.max(260, barData.length * 36 + 80)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tile
          label={t("avg.negToContract")}
          value={result.avgDaysNegToContract ?? null}
          color="text-zinc-100"
          unit={t("avg.daysUnit")}
        />
        <Tile
          label={t("avg.contractToFinalized")}
          value={result.avgDaysContractToFinalized ?? null}
          color="text-zinc-100"
          unit={t("avg.daysUnit")}
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

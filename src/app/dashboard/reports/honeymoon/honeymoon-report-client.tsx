"use client";

import { useTranslations } from "next-intl";
import { StackedBar, type StackSeries } from "@/components/charts/stacked-bar";
import { RadialProgress } from "@/components/charts/radial-progress";
import { formatCurrency } from "@/lib/format";
import type { HoneymoonProgress } from "@/lib/reports/honeymoon-progress";

const KIND_KEYS = new Set([
  "FLIGHT",
  "HOTEL",
  "TRANSFER",
  "ACTIVITY",
  "DOCUMENT",
  "BAGGAGE",
  "OTHER",
]);

export function HoneymoonReportClient({ result }: { result: HoneymoonProgress }) {
  const t = useTranslations("dashboard.reports.honeymoon");

  const STACK_SERIES: StackSeries[] = [
    { key: "PAID", label: t("status.paid"), color: "#22c55e" },
    { key: "CONFIRMED", label: t("status.confirmed"), color: "#8b5cf6" },
    { key: "BOOKED", label: t("status.booked"), color: "#3b82f6" },
    { key: "PLANNED", label: t("status.planned"), color: "#71717a" },
    { key: "CANCELLED", label: t("status.cancelled"), color: "#f43f5e" },
  ];

  const kindLabel = (kind: string) => (KIND_KEYS.has(kind) ? t(`kind.${kind}`) : kind);

  const byKindData = result.byKind.map((k) => ({
    name: kindLabel(k.kind),
    PAID: k.counts.PAID,
    CONFIRMED: k.counts.CONFIRMED,
    BOOKED: k.counts.BOOKED,
    PLANNED: k.counts.PLANNED,
    CANCELLED: k.counts.CANCELLED,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Tile label={t("tiles.items")} value={String(result.itemsCount)} />
        <Tile label={t("tiles.booked")} value={formatCurrency(result.bookedBRL)} color="text-violet-400" />
        <Tile label={t("tiles.paid")} value={formatCurrency(result.paidBRL)} color="text-emerald-400" />
        <Tile
          label={t("tiles.fundedFromGifts")}
          value={formatCurrency(result.fundedFromGiftsBRL)}
          color="text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-zinc-200">{t("coverage.title")}</h2>
          {result.budgetBRL !== null && result.budgetBRL > 0 ? (
            <RadialProgress
              value={result.fundedFromGiftsBRL}
              max={result.budgetBRL}
              label={`${formatCurrency(result.fundedFromGiftsBRL)} / ${formatCurrency(result.budgetBRL)}`}
              sublabel={t("coverage.sublabel")}
              color="#22c55e"
            />
          ) : (
            <p className="text-sm text-zinc-500">{t("coverage.empty")}</p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">{t("byKind.title")}</h2>
          {byKindData.length > 0 ? (
            <StackedBar
              data={byKindData}
              series={STACK_SERIES}
              horizontal
              height={Math.max(220, byKindData.length * 36 + 60)}
            />
          ) : (
            <p className="text-sm text-zinc-500">{t("byKind.empty")}</p>
          )}
        </div>
      </div>

      {Object.keys(result.byCurrency).filter((c) => c !== "BRL").length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="text-sm font-semibold text-amber-300">{t("foreignCurrency.title")}</h3>
          <p className="mt-1 text-xs text-amber-200/80">{t("foreignCurrency.body")}</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100">
            {Object.entries(result.byCurrency)
              .filter(([k]) => k !== "BRL")
              .map(([currency, total]) => (
                <li key={currency}>
                  {currency}: {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  color = "text-zinc-100",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

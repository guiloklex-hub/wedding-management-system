"use client";

import { useTranslations } from "next-intl";
import { Donut, type DonutDatum } from "@/components/charts/donut";
import { StackedBar, type StackSeries } from "@/components/charts/stacked-bar";
import type { GuestsAnalytics } from "@/lib/reports/guests-analytics";

const RSVP_COLORS: Record<string, string> = {
  CONFIRMED: "#22c55e",
  MAYBE: "#f59e0b",
  DECLINED: "#f43f5e",
  INVITED: "#71717a",
};

export function GuestsReportClient({ result }: { result: GuestsAnalytics }) {
  const t = useTranslations("dashboard.reports.guests");

  const STACK_SERIES: StackSeries[] = [
    { key: "CONFIRMED", label: t("status.confirmed"), color: "#22c55e" },
    { key: "MAYBE", label: t("status.maybe"), color: "#f59e0b" },
    { key: "INVITED", label: t("status.pending"), color: "#71717a" },
    { key: "DECLINED", label: t("status.declined"), color: "#f43f5e" },
  ];

  const donutData: DonutDatum[] = [
    { name: t("status.confirmed"), value: result.byStatus.CONFIRMED, color: RSVP_COLORS.CONFIRMED },
    { name: t("status.maybe"), value: result.byStatus.MAYBE, color: RSVP_COLORS.MAYBE },
    { name: t("status.declined"), value: result.byStatus.DECLINED, color: RSVP_COLORS.DECLINED },
    { name: t("status.pending"), value: result.byStatus.INVITED, color: RSVP_COLORS.INVITED },
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
        <Tile label={t("tiles.invited")} value={result.totalInvited} />
        <Tile label={t("tiles.confirmed")} value={result.totalConfirmed} color="text-emerald-400" />
        <Tile label={t("tiles.plusOnes")} value={result.plusOnesConfirmed} color="text-violet-400" />
        <Tile label={t("tiles.children")} value={result.children} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">{t("rsvp.title")}</h2>
          <Donut data={donutData} valueFormatter={(n) => t("rsvp.peopleCount", { count: n })} />
          <p className="mt-2 text-center text-xs text-zinc-500">
            {t("rsvp.effectiveLabel")}{" "}
            <span className="font-semibold text-zinc-200">{result.effectiveConfirmed}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">{t("byGroup.title")}</h2>
          {groupData.length > 0 ? (
            <StackedBar
              data={groupData}
              series={STACK_SERIES}
              horizontal
              height={Math.max(220, groupData.length * 36 + 60)}
            />
          ) : (
            <p className="text-sm text-zinc-500">{t("byGroup.empty")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">{t("vips.title")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <Tile label={t("vips.vipsConfirmed")} value={result.vipsConfirmed} color="text-amber-400" />
            <Tile label={t("vips.padrinhosConfirmed")} value={result.padrinhosConfirmed} color="text-violet-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">{t("cities.title")}</h2>
          {result.byCity.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("cities.empty")}</p>
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

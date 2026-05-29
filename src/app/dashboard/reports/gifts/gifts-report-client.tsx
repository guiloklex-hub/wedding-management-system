"use client";

import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Donut, type DonutDatum } from "@/components/charts/donut";
import {
  CHART_AXIS_STROKE,
  CHART_AXIS_TEXT,
  CHART_GRID_STROKE,
  CHART_TOOLTIP_STYLE,
} from "@/components/charts/chart-theme";
import { formatCurrency } from "@/lib/format";
import type { GiftsAnalytics } from "@/lib/reports/gifts-analytics";

export function GiftsReportClient({
  result,
  showFinance,
}: {
  result: GiftsAnalytics;
  showFinance: boolean;
}) {
  const t = useTranslations("dashboard.reports.gifts");
  const typeDonut: DonutDatum[] = [
    { name: t("type.cash"), value: result.byType.cash, color: "#22c55e" },
    { name: t("type.item"), value: result.byType.item, color: "#8b5cf6" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Tile label={t("tiles.count")} value={result.totalCount} />
        {showFinance ? (
          <Tile label={t("tiles.totalCash")} value={formatCurrency(result.totalCash)} color="text-emerald-400" />
        ) : (
          <Tile label={t("tiles.cashCount")} value={`${result.byType.cash}`} color="text-emerald-400" />
        )}
        <Tile
          label={t("tiles.thanked")}
          value={`${Math.round(result.thankedPct * 100)}%`}
          color="text-zinc-100"
          sub={t("tiles.thankedSub", { count: result.thankedCount, total: result.totalCount })}
        />
        {showFinance ? (
          <Tile
            label={t("tiles.honeymoon")}
            value={formatCurrency(result.honeymoonShareTotal)}
            color="text-violet-400"
            sub={t("tiles.contributions", { count: result.honeymoonShareCount })}
          />
        ) : (
          <Tile
            label={t("tiles.honeymoon")}
            value={`${result.honeymoonShareCount}`}
            color="text-violet-400"
            sub={t("tiles.contributionsShort")}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">{t("distribution.title")}</h2>
          <Donut data={typeDonut} valueFormatter={(n) => t("distribution.giftCount", { count: n })} />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">{t("cumulative.title")}</h2>
          {result.weeklyAccum.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("cumulative.empty")}</p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.weeklyAccum} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={CHART_AXIS_STROKE} tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }} />
                  <YAxis
                    stroke={CHART_AXIS_STROKE}
                    tick={{ fill: CHART_AXIS_TEXT, fontSize: 11 }}
                    tickFormatter={(v: number) => (showFinance ? formatCurrency(v) : String(v))}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    itemStyle={{ color: "#fff" }}
                    formatter={(v, name) => {
                      const isCumulative = name === "cumulative";
                      const label = isCumulative ? t("cumulative.legendAmount") : t("cumulative.legendCount");
                      const display =
                        isCumulative && showFinance ? formatCurrency(Number(v ?? 0)) : String(v ?? 0);
                      return [display, label];
                    }}
                  />
                  {showFinance ? (
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">{t("topGivers.title")}</h2>
        {result.topGivers.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("topGivers.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {result.topGivers.map((g, i) => (
              <li
                key={`${g.name}-${i}`}
                className="flex items-center justify-between border-b border-zinc-800 pb-2 text-sm"
              >
                <span className="text-zinc-200">
                  <span className="mr-2 text-xs text-zinc-500">#{i + 1}</span>
                  {g.name}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">{t("topGivers.giftCount", { count: g.count })}</span>
                  {showFinance && g.total > 0 ? (
                    <span className="font-semibold text-emerald-300">{formatCurrency(g.total)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  color = "text-zinc-100",
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {sub ? <p className="mt-1 text-[10px] text-zinc-500">{sub}</p> : null}
    </div>
  );
}

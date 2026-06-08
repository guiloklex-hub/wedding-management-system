import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CalendarHeart,
  CheckCircle2,
  CreditCard,
  PieChart as PieChartIcon,
  Sparkles,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { loadDashboardData } from "@/lib/reports/dashboard-data";
import { canViewSensitiveFinance } from "@/lib/permissions";
import { formatCurrency, formatDateBR } from "@/lib/format";
import DashboardCharts, { type ChartDatum } from "./charts";
import { KpiCard } from "./_components/kpi-card";
import { FunnelCard } from "./_components/funnel-card";
import { RiskAlertStrip } from "./_components/risk-alert-strip";
import { ActionStreamCard } from "./_components/action-stream-card";
import { RsvpMini } from "./_components/rsvp-mini";
import { GiftsMini } from "./_components/gifts-mini";
import { UpcomingTasks } from "./_components/upcoming-tasks";
import { PWABadge } from "@/components/pwa-badge";
import { InstallPrompt } from "./_components/install-prompt";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const finance = canViewSensitiveFinance(role);
  const t = await getTranslations("dashboard.home");

  const data = await loadDashboardData(role);

  const subtitle = data.eventDate
    ? data.coupleNames
      ? `${data.coupleNames} · ${formatDateBR(data.eventDate)}`
      : t("header.weddingOn", { date: formatDateBR(data.eventDate) })
    : t("header.configurePrompt");

  const trendData = data.paidMonthly.map((m) => ({ label: m.label, value: m.value }));

  const categoryData: ChartDatum[] = data.budgetByCategory.map((c) => ({
    name: c.name,
    value: c.value,
    color: c.color,
  }));

  const showQuitAlert =
    data.daysToEvent !== null && data.daysToEvent <= 20 && data.remainingBalance > 0;

  return (
    <div className="min-w-0 space-y-6">
      <PWABadge count={data.tasksStats.overdue} />
      <InstallPrompt />
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{t("header.title")}</h1>
          <p className="break-words text-sm text-zinc-500">{subtitle}</p>
        </div>
        {data.daysToEvent !== null ? <CountdownPill days={data.daysToEvent} /> : null}
      </div>

      {!data.eventDate ? (
        <Link
          href="/dashboard/onboarding"
          prefetch={false}
          className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-zinc-900/30 p-5 shadow-sm transition-colors hover:from-rose-500/25"
        >
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div>
            <h3 className="font-semibold text-rose-100">{t("onboarding.title")}</h3>
            <p className="mt-1 text-sm text-zinc-300">{t("onboarding.body")}</p>
          </div>
        </Link>
      ) : null}

      {showQuitAlert ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 shadow-sm backdrop-blur-sm">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">{t("quitAlert.title")}</h3>
            <p className="text-sm">
              {t("quitAlert.body", {
                days: data.daysToEvent ?? 0,
                balance: finance
                  ? formatCurrency(data.remainingBalance)
                  : t("quitAlert.pendingValues"),
              })}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {finance ? (
          <>
            <KpiCard
              title={t("kpi.totalBudget.title")}
              value={formatCurrency(data.totalBudget)}
              icon={<Wallet className="h-5 w-5" />}
              hint={t("kpi.totalBudget.hint", { value: formatCurrency(data.contingencyFund) })}
            />
            <KpiCard
              title={t("kpi.totalPaid.title")}
              value={formatCurrency(data.totalPaid)}
              icon={<CreditCard className="h-5 w-5" />}
              accent="emerald"
              trend={trendData}
              hint={t("kpi.totalPaid.hint", { pct: Math.round(data.paidPct * 100) })}
            />
            <KpiCard
              title={t("kpi.remainingBalance.title")}
              value={formatCurrency(data.remainingBalance)}
              icon={<TrendingDown className="h-5 w-5" />}
              accent="rose"
            />
            <KpiCard
              title={t("kpi.cashCoverage.title")}
              value={formatCurrency(data.totalAssets)}
              icon={<Wallet className="h-5 w-5" />}
              accent="emerald"
              hint={
                data.remainingBalance > 0
                  ? t("kpi.cashCoverage.hintPct", {
                      pct: Math.min(100, Math.round((data.totalAssets / data.remainingBalance) * 100)),
                    })
                  : t("kpi.cashCoverage.hintPaid")
              }
            />
          </>
        ) : (
          <>
            <KpiCard
              title={t("kpi.vendors.title")}
              value={`${data.vendorFunnel.CONTRACTED + data.vendorFunnel.FINALIZED}/${
                data.vendorFunnel.NEGOTIATION + data.vendorFunnel.CONTRACTED + data.vendorFunnel.FINALIZED
              }`}
              icon={<Users className="h-5 w-5" />}
              accent="violet"
              hint={t("kpi.vendors.hint", { pct: Math.round(data.contractedPct * 100) })}
            />
            <KpiCard
              title={t("kpi.tasks.title")}
              value={`${data.tasksStats.done}/${data.tasksStats.total}`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              accent="emerald"
              hint={
                data.tasksStats.overdue > 0
                  ? t("kpi.tasks.hintOverdue", { count: data.tasksStats.overdue })
                  : t("kpi.tasks.hintUpToDate")
              }
            />
            <KpiCard
              title={t("kpi.guests.title")}
              value={`${data.rsvp.confirmed}`}
              icon={<Users className="h-5 w-5" />}
              accent="emerald"
              hint={t("kpi.guests.hint", {
                total: data.guestsTotal,
                confirmed: data.rsvp.confirmed,
              })}
            />
            <KpiCard
              title={t("kpi.daysToEvent.title")}
              value={data.daysToEvent !== null ? String(data.daysToEvent) : "—"}
              icon={<CalendarHeart className="h-5 w-5" />}
              accent="rose"
            />
          </>
        )}
      </div>

      <ActionStreamCard items={data.actionStream} canSeeFinance={finance} />

      <RiskAlertStrip risks={data.risks} canSeeFinance={finance} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FunnelCard funnel={data.vendorFunnel} />
        {finance ? (
          <KpiCard
            title={t("kpi.budgetSummary.title")}
            value={formatCurrency(data.totalBudget)}
            icon={<Wallet className="h-5 w-5" />}
            hint={t("kpi.budgetSummary.hint", {
              contracted: formatCurrency(data.totalContracted),
              paid: formatCurrency(data.totalPaid),
            })}
            href="/dashboard/insights"
          />
        ) : (
          <UpcomingTasks tasks={data.upcomingTasks} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {finance ? (
          <>
            <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm lg:max-h-[380px]">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">{t("budgetDistribution.title")}</h2>
                <PieChartIcon className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="h-[260px] lg:h-auto lg:min-h-0 lg:flex-1">
                <DashboardCharts data={categoryData} />
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm lg:max-h-[380px]">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">{t("upcomingPayments.title")}</h2>
                <CalendarClock className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                {data.upcomingPayments.length === 0 ? (
                  <p className="text-sm text-zinc-500">{t("upcomingPayments.empty")}</p>
                ) : (
                  data.upcomingPayments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-800/50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-200">{p.vendorName}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {t("upcomingPayments.dueLabel", { date: formatDateBR(p.dueDate) })}
                        </p>
                      </div>
                      <span className="shrink-0 pl-3 font-semibold text-rose-400">{formatCurrency(p.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <UpcomingTasks tasks={data.upcomingTasks} compact />
          </>
        ) : (
          <>
            <RsvpMini rsvp={data.rsvp} guestsTotal={data.guestsTotal} />
            <GiftsMini
              totalCount={data.giftsProgress.totalCount}
              cashCount={data.giftsProgress.cashCount}
              cashTotal={data.giftsProgress.cashTotal}
              thankedCount={data.giftsProgress.thankedCount}
              thankedPct={data.giftsProgress.thankedPct}
            />
            <UpcomingTasks tasks={data.upcomingTasks} />
          </>
        )}
      </div>

      {finance ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RsvpMini rsvp={data.rsvp} guestsTotal={data.guestsTotal} />
          <GiftsMini
            totalCount={data.giftsProgress.totalCount}
            cashCount={data.giftsProgress.cashCount}
            cashTotal={data.giftsProgress.cashTotal}
            thankedCount={data.giftsProgress.thankedCount}
            thankedPct={data.giftsProgress.thankedPct}
          />
        </div>
      ) : null}
    </div>
  );
}

async function CountdownPill({ days }: { days: number }) {
  const t = await getTranslations("dashboard.home");
  const status =
    days < 0
      ? { text: t("countdown.past"), tone: "bg-zinc-800 text-zinc-400 border-zinc-700" }
      : days === 0
        ? { text: t("countdown.today"), tone: "bg-rose-500/15 text-rose-300 border-rose-500/30" }
        : days <= 30
          ? { text: t("countdown.remaining", { days }), tone: "bg-rose-500/10 text-rose-300 border-rose-500/30" }
          : days <= 90
            ? { text: t("countdown.remaining", { days }), tone: "bg-amber-500/10 text-amber-300 border-amber-500/30" }
            : { text: t("countdown.remaining", { days }), tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" };

  return (
    <span className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-sm font-medium ${status.tone}`}>
      <CalendarHeart className="h-4 w-4" />
      {status.text}
    </span>
  );
}

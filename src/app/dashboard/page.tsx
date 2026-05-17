import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CalendarHeart,
  CheckCircle2,
  CreditCard,
  ListTodo,
  PieChart as PieChartIcon,
  Sparkles,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import { auth } from "@/auth";
import { loadDashboardData } from "@/lib/reports/dashboard-data";
import { canViewSensitiveFinance } from "@/lib/permissions";
import { formatCurrency, formatDateBR } from "@/lib/format";
import DashboardCharts, { type ChartDatum } from "./charts";
import { KpiCard } from "./_components/kpi-card";
import { FunnelCard } from "./_components/funnel-card";
import { RiskAlertStrip } from "./_components/risk-alert-strip";
import { RsvpMini } from "./_components/rsvp-mini";
import { GiftsMini } from "./_components/gifts-mini";
import { UpcomingTasks } from "./_components/upcoming-tasks";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const finance = canViewSensitiveFinance(role);

  const data = await loadDashboardData(role);

  const subtitle = data.eventDate
    ? data.coupleNames
      ? `${data.coupleNames} · ${formatDateBR(data.eventDate)}`
      : `Casamento em ${formatDateBR(data.eventDate)}`
    : "Configure seu evento para começar";

  const trendData = data.paidMonthly.map((m) => ({ label: m.label, value: m.value }));

  const categoryData: ChartDatum[] = data.budgetByCategory.map((c) => ({
    name: c.name,
    value: c.value,
    color: c.color,
  }));

  const showQuitAlert =
    data.daysToEvent !== null && data.daysToEvent <= 20 && data.remainingBalance > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-sm text-zinc-500">{subtitle}</p>
        </div>
        {data.daysToEvent !== null ? <CountdownPill days={data.daysToEvent} /> : null}
      </div>

      {!data.eventDate ? (
        <Link
          href="/dashboard/onboarding"
          className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-zinc-900/30 p-5 shadow-sm transition-colors hover:from-rose-500/25"
        >
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div>
            <h3 className="font-semibold text-rose-100">Vamos configurar seu casamento?</h3>
            <p className="mt-1 text-sm text-zinc-300">
              Em menos de 2 minutos você define a data, os nomes do casal e como as
              notificações vão funcionar. Clique aqui para iniciar o assistente.
            </p>
          </div>
        </Link>
      ) : null}

      {showQuitAlert ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 shadow-sm backdrop-blur-sm">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Alerta de Quitação!</h3>
            <p className="text-sm">
              Faltam {data.daysToEvent} dia(s) e ainda há saldo devedor de{" "}
              {finance ? formatCurrency(data.remainingBalance) : "valores pendentes"}.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {finance ? (
          <>
            <KpiCard
              title="Orçamento Total"
              value={formatCurrency(data.totalBudget)}
              icon={<Wallet className="h-5 w-5" />}
              hint={`Contingência: ${formatCurrency(data.contingencyFund)}`}
            />
            <KpiCard
              title="Total Já Pago"
              value={formatCurrency(data.totalPaid)}
              icon={<CreditCard className="h-5 w-5" />}
              accent="emerald"
              trend={trendData}
              hint={`${Math.round(data.paidPct * 100)}% do orçamento`}
            />
            <KpiCard
              title="Saldo Devedor"
              value={formatCurrency(data.remainingBalance)}
              icon={<TrendingDown className="h-5 w-5" />}
              accent="rose"
            />
            <KpiCard
              title="Cobertura de Caixa"
              value={formatCurrency(data.totalAssets)}
              icon={<Wallet className="h-5 w-5" />}
              accent="emerald"
              hint={
                data.remainingBalance > 0
                  ? `${Math.min(100, Math.round((data.totalAssets / data.remainingBalance) * 100))}% do saldo devedor`
                  : "Saldo quitado"
              }
            />
          </>
        ) : (
          <>
            <KpiCard
              title="Fornecedores"
              value={`${data.vendorFunnel.CONTRACTED + data.vendorFunnel.FINALIZED}/${
                data.vendorFunnel.NEGOTIATION + data.vendorFunnel.CONTRACTED + data.vendorFunnel.FINALIZED
              }`}
              icon={<Users className="h-5 w-5" />}
              accent="violet"
              hint={`${Math.round(data.contractedPct * 100)}% contratados`}
            />
            <KpiCard
              title="Tarefas"
              value={`${data.tasksStats.done}/${data.tasksStats.total}`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              accent="emerald"
              hint={
                data.tasksStats.overdue > 0
                  ? `${data.tasksStats.overdue} atrasada(s)`
                  : "Tudo em dia"
              }
            />
            <KpiCard
              title="Convidados"
              value={`${data.rsvp.confirmed}`}
              icon={<Users className="h-5 w-5" />}
              accent="emerald"
              hint={`${data.guestsTotal} no total · ${data.rsvp.confirmed} confirmados`}
            />
            <KpiCard
              title="Dias para o evento"
              value={data.daysToEvent !== null ? String(data.daysToEvent) : "—"}
              icon={<CalendarHeart className="h-5 w-5" />}
              accent="rose"
            />
          </>
        )}
      </div>

      <RiskAlertStrip risks={data.risks} canSeeFinance={finance} />

      <div className="grid gap-6 md:grid-cols-2">
        <FunnelCard funnel={data.vendorFunnel} />
        {finance ? (
          <KpiCard
            title="Resumo do Orçamento"
            value={formatCurrency(data.totalBudget)}
            icon={<Wallet className="h-5 w-5" />}
            hint={`Contratado: ${formatCurrency(data.totalContracted)} · Pago: ${formatCurrency(data.totalPaid)}`}
            href="/dashboard/insights"
          />
        ) : (
          <UpcomingTasks tasks={data.upcomingTasks} />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {finance ? (
          <>
            <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm lg:max-h-[380px]">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">Distribuição do Orçamento</h2>
                <PieChartIcon className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="min-h-0 flex-1">
                <DashboardCharts data={categoryData} />
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm lg:max-h-[380px]">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">Próximos Vencimentos</h2>
                <CalendarClock className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                {data.upcomingPayments.length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhum pagamento para os próximos 30 dias.</p>
                ) : (
                  data.upcomingPayments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-800/50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-200">{p.vendorName}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Venc.: {formatDateBR(p.dueDate)}
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
        <div className="grid gap-6 md:grid-cols-2">
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

function CountdownPill({ days }: { days: number }) {
  const status =
    days < 0
      ? { text: "Evento já passou", tone: "bg-zinc-800 text-zinc-400 border-zinc-700" }
      : days === 0
        ? { text: "Hoje é o dia!", tone: "bg-rose-500/15 text-rose-300 border-rose-500/30" }
        : days <= 30
          ? { text: `Faltam ${days} dias`, tone: "bg-rose-500/10 text-rose-300 border-rose-500/30" }
          : days <= 90
            ? { text: `Faltam ${days} dias`, tone: "bg-amber-500/10 text-amber-300 border-amber-500/30" }
            : { text: `Faltam ${days} dias`, tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" };

  return (
    <span className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-sm font-medium ${status.tone}`}>
      <CalendarHeart className="h-4 w-4" />
      {status.text}
    </span>
  );
}

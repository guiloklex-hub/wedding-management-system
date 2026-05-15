import Link from "next/link";
import { AlertCircle, CalendarClock, CalendarHeart, CreditCard, Sparkles, TrendingDown, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

import { getEventConfig, daysUntil } from "@/lib/event-config";
import { resolveCategoryColor, resolveCategoryLabel } from "@/lib/categories";
import { formatCurrency, formatDateBR } from "@/lib/format";
import DashboardCharts, { type ChartDatum } from "./charts";

export default async function DashboardPage() {
  const cfg = await getEventConfig();
  const eventDate = cfg.eventDate;

  const [vendors, payments, assets] = await Promise.all([
    prisma.vendor.findMany({
      where: { deletedAt: null },
      include: {
        budgetItems: { where: { deletedAt: null } },
        payments: { where: { deletedAt: null } },
      },
    }),
    prisma.payment.findMany({
      where: { deletedAt: null },
      include: { vendor: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.asset.findMany({ where: { deletedAt: null } }),
  ]);

  const contractedVendors = vendors.filter((v) => v.status === "CONTRACTED" || v.status === "FINALIZED");
  const totalContracted = contractedVendors.reduce((acc, v) => {
    const cost = v.budgetItems.reduce((sum, item) => sum + (item.actualValue ?? item.estimatedValue), 0);
    return acc + cost;
  }, 0);
  const contingencyFund = totalContracted * (cfg.contingencyPercent / 100);

  const totalBudget =
    vendors.reduce((acc, v) => {
      const cost = v.budgetItems.reduce((sum, item) => sum + (item.actualValue ?? item.estimatedValue), 0);
      return acc + cost;
    }, 0) + contingencyFund;

  const totalPaid = payments.filter((p) => p.status === "PAID").reduce((acc, p) => acc + p.amount, 0);
  const remainingBalance = totalBudget - totalPaid;
  const totalAssets = assets.reduce((acc, a) => acc + a.amount, 0);

  const categoryMap = new Map<string, { value: number; color: string }>();
  for (const v of vendors) {
    const cost = v.budgetItems.reduce((sum, item) => sum + (item.actualValue ?? item.estimatedValue), 0);
    const label = resolveCategoryLabel(v.categoryKey, v.category);
    const color = resolveCategoryColor(v.categoryKey);
    const current = categoryMap.get(label);
    categoryMap.set(label, { value: (current?.value ?? 0) + cost, color });
  }
  if (contingencyFund > 0) {
    categoryMap.set("Fundo de Contingência", { value: contingencyFund, color: "#a1a1aa" });
  }
  const categoryData: ChartDatum[] = Array.from(categoryMap.entries()).map(([name, v]) => ({
    name,
    value: v.value,
    color: v.color,
  }));

  const today = new Date();
  const next30 = new Date(today);
  next30.setDate(today.getDate() + 30);
  const upcoming = payments.filter((p) => p.status === "PENDING" && p.dueDate <= next30);

  const daysToEvent = eventDate ? daysUntil(eventDate, today) : null;
  const showQuitAlert = daysToEvent !== null && daysToEvent <= 20;
  const vendorsWithPending = vendors.filter((v) => {
    const total = v.budgetItems.reduce((s, i) => s + (i.actualValue ?? i.estimatedValue), 0);
    const paid = v.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
    return total > paid;
  });

  const subtitle = eventDate
    ? cfg.coupleNames
      ? `${cfg.coupleNames} · ${formatDateBR(eventDate)}`
      : `Casamento em ${formatDateBR(eventDate)}`
    : "Configure seu evento para começar";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-sm text-zinc-500">{subtitle}</p>
        </div>
        {daysToEvent !== null ? <CountdownPill days={daysToEvent} /> : null}
      </div>

      {!eventDate ? (
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

      {showQuitAlert && vendorsWithPending.length > 0 && daysToEvent !== null ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 shadow-sm backdrop-blur-sm">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Alerta de Quitação!</h3>
            <p className="text-sm">Faltam {daysToEvent} dia(s) e há {vendorsWithPending.length} fornecedor(es) com saldo devedor.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Orçamento Total" value={totalBudget} icon={<Wallet className="h-5 w-5" />} />
        <Card title="Total Já Pago" value={totalPaid} icon={<CreditCard className="h-5 w-5" />} accent="emerald" />
        <Card title="Saldo Devedor" value={remainingBalance} icon={<TrendingDown className="h-5 w-5" />} accent="rose" />
        <Card title="Cobertura de Caixa" value={totalAssets} icon={<Wallet className="h-5 w-5" />} accent="emerald" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Distribuição do Orçamento</h2>
          <DashboardCharts data={categoryData} />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Próximos Vencimentos (30 dias)</h2>
            <CalendarClock className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="custom-scrollbar max-h-[300px] space-y-3 overflow-y-auto pr-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum pagamento para os próximos 30 dias.</p>
            ) : (
              upcoming.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-800/50 p-3">
                  <div>
                    <p className="font-medium text-zinc-200">{p.vendor.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">Vencimento: {formatDateBR(p.dueDate)}</p>
                  </div>
                  <span className="font-semibold text-rose-400">{formatCurrency(p.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  icon,
  accent = "default",
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent?: "default" | "rose" | "emerald";
}) {
  const accentClass =
    accent === "rose"
      ? "text-rose-500"
      : accent === "emerald"
        ? "text-emerald-500"
        : "text-zinc-500";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm backdrop-blur-sm transition-all hover:bg-zinc-800/50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
        <div className={`rounded-lg border border-zinc-800 bg-zinc-800/50 p-2 ${accentClass}`}>{icon}</div>
      </div>
      <div className="mt-4">
        <span className="text-3xl font-bold tracking-tight text-zinc-100">{formatCurrency(value)}</span>
      </div>
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

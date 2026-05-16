import { prisma } from "@/lib/prisma";
import { canViewSensitiveFinance } from "@/lib/permissions";
import { getEventConfig, daysUntil } from "@/lib/event-config";
import { resolveCategoryColor, resolveCategoryLabel } from "@/lib/categories";
import {
  buildMonthlyCashflow,
  type MonthlyPoint,
} from "@/lib/cashflow";
import { computeRiskAlerts } from "./risk-radar";
import type { RiskAlert } from "./types";

export type CategoryDatum = { name: string; value: number; color: string };

export type DashboardData = {
  canSeeFinance: boolean;
  coupleNames: string | null;
  eventDate: Date | null;
  daysToEvent: number | null;
  contingencyPercent: number;

  totalBudget: number;
  totalContracted: number;
  totalPaid: number;
  remainingBalance: number;
  totalAssets: number;
  contingencyFund: number;

  paidMonthly: Array<{ label: string; value: number }>;

  upcomingPayments: Array<{
    id: string;
    vendorName: string;
    amount: number;
    dueDate: Date;
  }>;
  upcomingTasks: Array<{
    id: string;
    title: string;
    priority: string;
    deadline: Date | null;
  }>;

  budgetByCategory: CategoryDatum[];

  vendorFunnel: { NEGOTIATION: number; CONTRACTED: number; FINALIZED: number };
  contractedPct: number;
  paidPct: number;

  rsvp: {
    invited: number;
    confirmed: number;
    declined: number;
    maybe: number;
    plusOnesConfirmed: number;
  };
  guestsTotal: number;

  giftsProgress: {
    totalCount: number;
    cashCount: number;
    cashTotal: number | null;
    thankedCount: number;
    thankedPct: number;
  };

  tasksStats: {
    total: number;
    done: number;
    overdue: number;
  };

  cashflow: MonthlyPoint[];
  worstCashflow: MonthlyPoint | null;

  risks: RiskAlert[];
};

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthLabelShort(d: Date): string {
  const m = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${m[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
}

export async function loadDashboardData(role: string | null | undefined): Promise<DashboardData> {
  const cfg = await getEventConfig();
  const today = new Date();
  const canSeeFinance = canViewSensitiveFinance(role);

  const [vendors, payments, assets, incomes, tasks, contracts, guests, gifts] = await Promise.all([
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
    prisma.income.findMany({ where: { deletedAt: null } }),
    prisma.task.findMany({ where: { deletedAt: null } }),
    prisma.contract.findMany({
      where: { deletedAt: null },
      include: { vendor: { select: { name: true } } },
    }),
    prisma.guest.findMany({ where: { deletedAt: null } }),
    prisma.gift.findMany({ where: { deletedAt: null } }),
  ]);

  let totalBudget = 0;
  let totalContracted = 0;
  let totalActual = 0;
  const categoryMap = new Map<string, { value: number; color: string }>();
  for (const v of vendors) {
    const cost = v.budgetItems.reduce(
      (s, b) => s + (b.actualValue ?? b.estimatedValue),
      0,
    );
    totalBudget += cost;
    totalActual += cost;
    if (v.status === "CONTRACTED" || v.status === "FINALIZED") totalContracted += cost;
    const label = resolveCategoryLabel(v.categoryKey, v.category);
    const color = resolveCategoryColor(v.categoryKey);
    const cur = categoryMap.get(label);
    categoryMap.set(label, { value: (cur?.value ?? 0) + cost, color });
  }
  const contingencyFund = totalContracted * (cfg.contingencyPercent / 100);
  const totalBudgetWithBuffer = totalBudget + contingencyFund;
  if (contingencyFund > 0) {
    categoryMap.set("Fundo de Contingência", {
      value: contingencyFund,
      color: "#a1a1aa",
    });
  }

  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);
  const remainingBalance = totalBudgetWithBuffer - totalPaid;
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);

  const monthlyPaid = new Map<string, { date: Date; value: number }>();
  const sixMonthsAgo = new Date(today.getTime() - 180 * 86400000);
  for (const p of payments) {
    if (p.status !== "PAID" || !p.paidAt) continue;
    if (p.paidAt < sixMonthsAgo) continue;
    const m = startOfMonthUTC(p.paidAt);
    const key = m.toISOString();
    const cur = monthlyPaid.get(key) ?? { date: m, value: 0 };
    cur.value += p.amount;
    monthlyPaid.set(key, cur);
  }
  const paidMonthly = Array.from(monthlyPaid.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((m) => ({ label: monthLabelShort(m.date), value: m.value }));

  const next30 = new Date(today.getTime() + 30 * 86400000);
  const upcomingPayments = payments
    .filter((p) => p.status === "PENDING" && p.dueDate <= next30 && p.dueDate >= today)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      vendorName: p.vendor.name,
      amount: p.amount,
      dueDate: p.dueDate,
    }));

  const upcomingTasks = tasks
    .filter((t) => t.status !== "DONE")
    .sort((a, b) => {
      const da = a.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
      const db = b.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
      return da - db;
    })
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      deadline: t.deadline,
    }));

  const vendorFunnel = { NEGOTIATION: 0, CONTRACTED: 0, FINALIZED: 0 } as Record<
    "NEGOTIATION" | "CONTRACTED" | "FINALIZED",
    number
  >;
  for (const v of vendors) {
    if (v.status === "NEGOTIATION") vendorFunnel.NEGOTIATION += 1;
    else if (v.status === "CONTRACTED") vendorFunnel.CONTRACTED += 1;
    else if (v.status === "FINALIZED") vendorFunnel.FINALIZED += 1;
  }
  const totalVendors = vendorFunnel.NEGOTIATION + vendorFunnel.CONTRACTED + vendorFunnel.FINALIZED;
  const contractedPct =
    totalVendors === 0 ? 0 : (vendorFunnel.CONTRACTED + vendorFunnel.FINALIZED) / totalVendors;
  const paidPct = totalBudgetWithBuffer === 0 ? 0 : totalPaid / totalBudgetWithBuffer;

  const rsvp = { invited: 0, confirmed: 0, declined: 0, maybe: 0, plusOnesConfirmed: 0 };
  for (const g of guests) {
    if (g.rsvpStatus === "INVITED") rsvp.invited += 1;
    else if (g.rsvpStatus === "CONFIRMED") rsvp.confirmed += 1;
    else if (g.rsvpStatus === "DECLINED") rsvp.declined += 1;
    else if (g.rsvpStatus === "MAYBE") rsvp.maybe += 1;
    rsvp.plusOnesConfirmed += g.plusOnesConfirmed ?? 0;
  }

  let cashCount = 0;
  let cashTotal = 0;
  let thankedCount = 0;
  for (const g of gifts) {
    if (g.type === "CASH") {
      cashCount += 1;
      cashTotal += g.amount ?? 0;
    }
    if (g.thankedAt) thankedCount += 1;
  }
  const giftsProgress = {
    totalCount: gifts.length,
    cashCount,
    cashTotal: canSeeFinance ? cashTotal : null,
    thankedCount,
    thankedPct: gifts.length === 0 ? 0 : thankedCount / gifts.length,
  };

  let tasksDone = 0;
  let tasksOverdue = 0;
  for (const t of tasks) {
    if (t.status === "DONE") tasksDone += 1;
    else if (t.deadline && t.deadline < today) tasksOverdue += 1;
  }

  const eventDate = cfg.eventDate;
  let cashflow: MonthlyPoint[] = [];
  if (eventDate) {
    cashflow = buildMonthlyCashflow({
      startingCash: totalAssets,
      eventDate,
      today,
      incomes,
      payments: payments.filter((p) => p.status !== "PAID"),
    });
  }
  const worstCashflow = cashflow
    .slice()
    .sort((a, b) => a.ending - b.ending)[0] ?? null;

  const risks = computeRiskAlerts({
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      dueDate: p.dueDate,
      paidAt: p.paidAt,
      status: p.status,
      vendor: p.vendor ? { id: p.vendor.id, name: p.vendor.name } : null,
      lateFeePercent: p.lateFeePercent ?? null,
      interestPercentPerMonth: p.interestPercentPerMonth ?? null,
    })),
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      status: v.status,
      budgetItems: v.budgetItems.map((b) => ({
        estimatedValue: b.estimatedValue,
        actualValue: b.actualValue ?? null,
      })),
    })),
    contracts: contracts.map((c) => ({
      id: c.id,
      vendorId: c.vendorId,
      status: c.status,
      expiresAt: c.expiresAt,
      vendor: { name: c.vendor?.name ?? "Fornecedor" },
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      deadline: t.deadline,
    })),
    cashflow: cashflow.map((c) => ({
      monthLabel: c.monthLabel,
      ending: c.ending,
      isNegative: c.isNegative,
    })),
    daysToEvent: eventDate ? daysUntil(eventDate, today) : null,
    today,
  });

  const budgetByCategory = Array.from(categoryMap.entries()).map(([name, m]) => ({
    name,
    value: m.value,
    color: m.color,
  }));

  void totalActual;

  return {
    canSeeFinance,
    coupleNames: cfg.coupleNames,
    eventDate,
    daysToEvent: eventDate ? daysUntil(eventDate, today) : null,
    contingencyPercent: cfg.contingencyPercent,

    totalBudget: totalBudgetWithBuffer,
    totalContracted,
    totalPaid,
    remainingBalance,
    totalAssets,
    contingencyFund,

    paidMonthly,

    upcomingPayments,
    upcomingTasks,

    budgetByCategory,

    vendorFunnel,
    contractedPct,
    paidPct,

    rsvp,
    guestsTotal: guests.length,

    giftsProgress,
    tasksStats: { total: tasks.length, done: tasksDone, overdue: tasksOverdue },

    cashflow,
    worstCashflow,

    risks,
  };
}

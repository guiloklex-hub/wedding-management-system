import { prisma } from "@/lib/prisma";
import { getEventConfig, daysUntil } from "@/lib/event-config";
import { resolveCategoryColor, resolveCategoryLabel } from "@/lib/categories";
import {
  buildCategoryWaterfall,
  buildMonthlyCashflow,
  buildPaymentHeatmap,
  computeCategoryCreep,
  computeHealthScore,
  projectLeftoverUntilEvent,
  type CategoryCreep,
  type HealthScoreResult,
  type MonthlyPoint,
  type PaymentHeatCell,
  type WaterfallBar,
} from "@/lib/cashflow";
import { buildPaymentSCurve, type PaymentCurvePoint } from "@/lib/reports/payment-curve";
import { buildTaskBurndown, type BurndownPoint } from "@/lib/reports/task-burndown";

export type InsightsSnapshot = {
  eventDate: Date;
  contingencyPercent: number;
  currency: string;
  coupleNames: string | null;
  totals: { budget: number; contracted: number; paid: number; cash: number };
  daysToEvent: number;
  leftover: number;
  cashflow: MonthlyPoint[];
  worstMonthlyBalance: number;
  health: HealthScoreResult;
  creep: CategoryCreep[];
  heatmap: PaymentHeatCell[];
  sCurve: PaymentCurvePoint[];
  burndown: BurndownPoint[];
  waterfall: WaterfallBar[];
};

/**
 * Agrega e calcula todos os indicadores da tela de Insights. Fonte única de
 * verdade reutilizada pela página `/dashboard/insights` e pela narrativa de IA.
 * Retorna `null` quando o evento ainda não tem data (onboarding incompleto).
 */
export async function loadInsightsSnapshot(
  today: Date = new Date(),
): Promise<InsightsSnapshot | null> {
  const cfg = await getEventConfig();
  if (!cfg.eventDate) return null;
  const eventDate = cfg.eventDate;

  const [vendors, payments, assets, incomes, tasks] = await Promise.all([
    prisma.vendor.findMany({
      where: { deletedAt: null },
      include: { budgetItems: { where: { deletedAt: null } } },
    }),
    prisma.payment.findMany({
      where: { deletedAt: null },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.asset.findMany({ where: { deletedAt: null } }),
    prisma.income.findMany({ where: { deletedAt: null } }),
    prisma.task.findMany({ where: { deletedAt: null } }),
  ]);

  const totalBudget = vendors.reduce(
    (s, v) => s + v.budgetItems.reduce((sum, b) => sum + (b.actualValue ?? b.estimatedValue), 0),
    0,
  );
  const contracted = vendors.filter((v) => v.status === "CONTRACTED" || v.status === "FINALIZED");
  const totalContracted = contracted.reduce(
    (s, v) => s + v.budgetItems.reduce((sum, b) => sum + (b.actualValue ?? b.estimatedValue), 0),
    0,
  );
  const totalPaid = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const totalCash = assets.reduce((s, a) => s + a.amount, 0);

  const cashflow = buildMonthlyCashflow({
    startingCash: totalCash,
    eventDate,
    today,
    incomes,
    payments: payments.filter((p) => p.status === "PENDING"),
  });

  const worstMonthlyBalance = cashflow.length
    ? Math.min(...cashflow.map((c) => c.ending))
    : totalCash;

  const tasksDone = tasks.filter((t) => t.status === "DONE").length;
  const tasksOverdue = tasks.filter(
    (t) => t.status !== "DONE" && t.deadline && new Date(t.deadline) < today,
  ).length;

  const daysToEvent = daysUntil(eventDate, today);
  const health = computeHealthScore({
    totalBudget,
    totalContracted,
    totalPaid,
    totalCash,
    daysToEvent,
    totalTasks: tasks.length,
    tasksDone,
    tasksOverdue,
    worstMonthlyBalance,
  });

  const creep = computeCategoryCreep(vendors, resolveCategoryColor, resolveCategoryLabel).filter(
    (c) => c.estimated > 0,
  );

  const heatStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const heatmap = buildPaymentHeatmap(
    payments.filter((p) => p.status === "PENDING"),
    heatStart,
    eventDate,
  );

  const sCurve = buildPaymentSCurve(
    payments.map((p) => ({
      amount: p.amount,
      dueDate: p.dueDate,
      paidAt: p.paidAt,
      status: p.status,
    })),
    cfg.contingencyPercent,
  );

  const burndown = buildTaskBurndown(
    tasks.map((t) => ({
      status: t.status,
      createdAt: t.createdAt,
      deadline: t.deadline,
      completedAt: t.completedAt,
    })),
    eventDate,
    today,
  );

  const waterfall = buildCategoryWaterfall(creep);

  const leftover = projectLeftoverUntilEvent({
    totalAssets: totalCash,
    remainingBudget: totalBudget - totalPaid,
    contingencyAmount: Math.round(totalContracted * (cfg.contingencyPercent / 100)),
  });

  return {
    eventDate,
    contingencyPercent: cfg.contingencyPercent,
    currency: cfg.currency,
    coupleNames: cfg.coupleNames,
    totals: { budget: totalBudget, contracted: totalContracted, paid: totalPaid, cash: totalCash },
    daysToEvent,
    leftover,
    cashflow,
    worstMonthlyBalance,
    health,
    creep,
    heatmap,
    sCurve,
    burndown,
    waterfall,
  };
}

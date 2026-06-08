import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getEventConfig, daysUntil } from "@/lib/event-config";
import { resolveCategoryColor, resolveCategoryLabel } from "@/lib/categories";
import { requireFinanceAccess } from "@/lib/finance-access";
import {
  buildCategoryWaterfall,
  buildMonthlyCashflow,
  buildPaymentHeatmap,
  computeCategoryCreep,
  computeHealthScore,
  projectLeftoverUntilEvent,
} from "@/lib/cashflow";
import { buildPaymentSCurve } from "@/lib/reports/payment-curve";
import { buildTaskBurndown } from "@/lib/reports/task-burndown";
import InsightsClient from "./insights-client";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  await requireFinanceAccess();
  const t = await getTranslations("dashboard.insights");

  const cfg = await getEventConfig();
  if (!cfg.eventDate) redirect("/dashboard/onboarding");

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
    (s, v) =>
      s +
      v.budgetItems.reduce(
        (sum, b) => sum + (b.actualValue ?? b.estimatedValue),
        0,
      ),
    0,
  );
  const contracted = vendors.filter((v) => v.status === "CONTRACTED" || v.status === "FINALIZED");
  const totalContracted = contracted.reduce(
    (s, v) =>
      s +
      v.budgetItems.reduce(
        (sum, b) => sum + (b.actualValue ?? b.estimatedValue),
        0,
      ),
    0,
  );
  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);
  const totalCash = assets.reduce((s, a) => s + a.amount, 0);

  const today = new Date();
  const cashflow = buildMonthlyCashflow({
    startingCash: totalCash,
    eventDate: eventDate,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("header.title")}</h1>
        <p className="text-sm text-zinc-500">{t("header.subtitle")}</p>
      </div>
      <InsightsClient
        eventDate={eventDate}
        contingencyPercent={cfg.contingencyPercent}
        totals={{
          budget: totalBudget,
          contracted: totalContracted,
          paid: totalPaid,
          cash: totalCash,
        }}
        daysToEvent={daysToEvent}
        leftover={leftover}
        cashflow={cashflow}
        worstMonthlyBalance={worstMonthlyBalance}
        health={health}
        creep={creep}
        heatmap={heatmap}
        sCurve={sCurve}
        burndown={burndown}
        waterfall={waterfall}
      />
    </div>
  );
}

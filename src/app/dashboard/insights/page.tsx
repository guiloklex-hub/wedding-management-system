import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEventConfig, daysUntil } from "@/lib/event-config";
import { resolveCategoryColor, resolveCategoryLabel } from "@/lib/categories";
import {
  buildMonthlyCashflow,
  buildPaymentHeatmap,
  computeCategoryCreep,
  computeHealthScore,
} from "@/lib/cashflow";
import InsightsClient from "./insights-client";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Insights financeiros</h1>
        <p className="text-sm text-zinc-500">
          Projeção, saúde do projeto e detector de orçamento por categoria.
        </p>
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
        cashflow={cashflow}
        worstMonthlyBalance={worstMonthlyBalance}
        health={health}
        creep={creep}
        heatmap={heatmap}
      />
    </div>
  );
}

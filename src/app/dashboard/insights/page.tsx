import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireFinanceAccess } from "@/lib/finance-access";
import { aiFeatureEnabled } from "@/lib/ai/aiAccess";
import { loadInsightsSnapshot } from "@/lib/reports/insights-snapshot";
import InsightsClient from "./insights-client";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  await requireFinanceAccess();
  const t = await getTranslations("dashboard.insights");

  const snapshot = await loadInsightsSnapshot();
  if (!snapshot) redirect("/dashboard/onboarding");

  const aiEnabled = await aiFeatureEnabled();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("header.title")}</h1>
        <p className="text-sm text-zinc-500">{t("header.subtitle")}</p>
      </div>
      <InsightsClient
        eventDate={snapshot.eventDate}
        contingencyPercent={snapshot.contingencyPercent}
        totals={snapshot.totals}
        daysToEvent={snapshot.daysToEvent}
        leftover={snapshot.leftover}
        cashflow={snapshot.cashflow}
        worstMonthlyBalance={snapshot.worstMonthlyBalance}
        health={snapshot.health}
        creep={snapshot.creep}
        heatmap={snapshot.heatmap}
        sCurve={snapshot.sCurve}
        burndown={snapshot.burndown}
        waterfall={snapshot.waterfall}
        aiEnabled={aiEnabled}
      />
    </div>
  );
}

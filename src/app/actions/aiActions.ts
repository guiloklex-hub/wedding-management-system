"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { denyIfNoFinance } from "@/lib/finance-access";
import { formatCurrency } from "@/lib/format";
import { coerceLocale } from "@/i18n/config";
import { aiFeatureEnabled } from "@/lib/ai/aiAccess";
import { getAiModel } from "@/lib/ai/config";
import { generateText } from "@/lib/ai/generate";
import { recordAiGeneration } from "@/lib/ai/log";
import { buildInsightsNarrativePrompt } from "@/lib/ai/prompts";
import { loadInsightsSnapshot } from "@/lib/reports/insights-snapshot";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/types";

const RESOURCE = "insights.narrative";

/**
 * Gera uma narrativa em linguagem natural sobre a saúde financeira do casamento,
 * a partir dos mesmos indicadores da tela de Insights. Read-only: não persiste no
 * domínio — o casal lê/copia o texto (sempre rotulado como gerado por IA).
 */
export async function generateInsightsNarrative(): Promise<ActionResult<string>> {
  const t = await getTranslations("actions.ai");

  const denied = await denyIfNoFinance();
  if (denied) return denied;

  if (!(await aiFeatureEnabled())) {
    return { success: false, error: t("disabled") };
  }

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { success: false, error: t("disabled") };

  const snapshot = await loadInsightsSnapshot();
  if (!snapshot) return { success: false, error: t("noEventDate") };

  const locale = coerceLocale(await getLocale());
  const fmt = (v: number) => formatCurrency(v, snapshot.currency, locale);

  const { system, user } = buildInsightsNarrativePrompt({
    locale,
    coupleNames: snapshot.coupleNames,
    daysToEvent: snapshot.daysToEvent,
    healthScore: snapshot.health.score,
    money: {
      budget: fmt(snapshot.totals.budget),
      contracted: fmt(snapshot.totals.contracted),
      paid: fmt(snapshot.totals.paid),
      cash: fmt(snapshot.totals.cash),
      leftover: fmt(snapshot.leftover),
      worstMonthlyBalance: fmt(snapshot.worstMonthlyBalance),
    },
    breakdown: snapshot.health.breakdown.map((b) => ({ label: b.label, pct: b.normalized })),
    alerts: snapshot.health.alerts,
    topCreep: snapshot.creep
      .filter((c) => c.delta > 0)
      .slice(0, 5)
      .map((c) => ({ category: c.category, deltaLabel: fmt(c.delta), pct: c.pct })),
  });

  const res = await generateText(user, {
    userId,
    resource: RESOURCE,
    locale,
    system,
    temperature: 0.4,
  });

  const model = getAiModel();

  if (!res.ok) {
    await recordAiGeneration({ userId, resource: RESOURCE, model, status: res.code });
    await audit("AiGeneration", "singleton", "AI_GENERATE", { resource: RESOURCE, status: res.code });
    return { success: false, error: t(`errors.${res.code}`) };
  }

  await recordAiGeneration({
    userId,
    resource: RESOURCE,
    model,
    status: "OK",
    usage: res.usage,
    outputPreview: res.data,
  });
  await audit("AiGeneration", "singleton", "AI_GENERATE", { resource: RESOURCE, status: "OK" });

  return { success: true, data: res.data };
}

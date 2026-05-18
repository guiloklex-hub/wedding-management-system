"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateEventConfig } from "@/lib/event-config";
import { audit } from "@/lib/audit";
import { LOCALES } from "@/i18n/config";
import type { ActionResult } from "@/types";

const CoupleSchema = z.object({
  coupleNames: z.string().trim().min(2).max(120),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  locale: z.enum(LOCALES).default("pt-BR"),
});

const BudgetSchema = z.object({
  contingencyPercent: z.coerce.number().min(0).max(50),
});

async function requireAdmin(): Promise<string> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    const tc = await getTranslations("actions.common");
    throw new Error(tc("forbidden"));
  }
  return (session?.user as { id?: string } | undefined)?.id ?? "unknown";
}

export async function saveCoupleStep(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.onboarding");
  try {
    const adminId = await requireAdmin();
    const parsed = CoupleSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.path[0];
      if (code === "coupleNames") {
        return { success: false, error: t("coupleNameRequired") };
      }
      if (code === "eventDate") {
        return { success: false, error: t("invalidDate") };
      }
      const tc = await getTranslations("actions.common");
      return { success: false, error: tc("invalid") };
    }

    await updateEventConfig({
      coupleNames: parsed.data.coupleNames,
      eventDate: new Date(parsed.data.eventDate),
      currency: parsed.data.currency,
      defaultLocale: parsed.data.locale,
    });
    if (adminId !== "unknown") {
      await prisma.user.update({
        where: { id: adminId },
        data: { locale: parsed.data.locale },
      });
    }
    await audit("EventSettings", "singleton", "ONBOARDING_COUPLE", parsed.data);
    return { success: true };
  } catch (err) {
    console.error("[saveCoupleStep]", err);
    return { success: false, error: t("errorCouple") };
  }
}

export async function saveBudgetStep(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.onboarding");
  try {
    await requireAdmin();
    const parsed = BudgetSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      const tc = await getTranslations("actions.common");
      return { success: false, error: tc("invalid") };
    }

    await updateEventConfig({ contingencyPercent: parsed.data.contingencyPercent });
    await audit("EventSettings", "singleton", "ONBOARDING_BUDGET", parsed.data);
    return { success: true };
  } catch (err) {
    console.error("[saveBudgetStep]", err);
    return { success: false, error: t("errorBudget") };
  }
}

export async function finishOnboarding(): Promise<ActionResult> {
  const t = await getTranslations("actions.onboarding");
  try {
    await requireAdmin();
    await updateEventConfig({ onboardingCompletedAt: new Date() });
    await audit("EventSettings", "singleton", "ONBOARDING_FINISH", {});
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("[finishOnboarding]", err);
    return { success: false, error: t("errorFinish") };
  }
}

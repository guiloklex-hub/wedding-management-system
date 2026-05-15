"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { updateEventConfig } from "@/lib/event-config";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/types";

const CoupleSchema = z.object({
  coupleNames: z.string().trim().min(2, "Informe o nome do casal").max(120),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
});

const BudgetSchema = z.object({
  contingencyPercent: z.coerce.number().min(0).max(50),
});

async function requireAdmin(): Promise<string> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") throw new Error("Acesso negado");
  return (session?.user as { id?: string } | undefined)?.id ?? "unknown";
}

export async function saveCoupleStep(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = CoupleSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    await updateEventConfig({
      coupleNames: parsed.data.coupleNames,
      eventDate: new Date(parsed.data.eventDate),
      currency: parsed.data.currency,
    });
    await audit("EventSettings", "singleton", "ONBOARDING_COUPLE", parsed.data);
    return { success: true };
  } catch (err) {
    console.error("[saveCoupleStep]", err);
    return { success: false, error: "Erro ao salvar dados do casal" };
  }
}

export async function saveBudgetStep(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = BudgetSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    await updateEventConfig({ contingencyPercent: parsed.data.contingencyPercent });
    await audit("EventSettings", "singleton", "ONBOARDING_BUDGET", parsed.data);
    return { success: true };
  } catch (err) {
    console.error("[saveBudgetStep]", err);
    return { success: false, error: "Erro ao salvar orçamento" };
  }
}

export async function finishOnboarding(): Promise<ActionResult> {
  try {
    await requireAdmin();
    await updateEventConfig({ onboardingCompletedAt: new Date() });
    await audit("EventSettings", "singleton", "ONBOARDING_FINISH", {});
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("[finishOnboarding]", err);
    return { success: false, error: "Erro ao concluir onboarding" };
  }
}

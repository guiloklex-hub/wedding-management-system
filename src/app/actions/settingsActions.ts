"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateEventConfig } from "@/lib/event-config";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/types";

const SettingsSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  contingencyPercent: z.coerce.number().min(0).max(100),
  currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  coupleNames: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function updateSettings(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const data = Object.fromEntries(formData.entries());
  const parsed = SettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await updateEventConfig({
      eventDate: new Date(parsed.data.eventDate),
      contingencyPercent: parsed.data.contingencyPercent,
      currency: parsed.data.currency,
      coupleNames: parsed.data.coupleNames,
    });
    await audit("EventSettings", "singleton", "UPDATE", {
      eventDate: parsed.data.eventDate,
      contingencyPercent: parsed.data.contingencyPercent,
    });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("[updateSettings]", err);
    return { success: false, error: "Erro ao salvar configurações" };
  }
}

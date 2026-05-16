"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateEventConfig } from "@/lib/event-config";
import { audit } from "@/lib/audit";
import { denyIfNoManage } from "@/lib/finance-access";
import type { ActionResult } from "@/types";

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const SettingsSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  contingencyPercent: z.coerce.number().min(0).max(100),
  currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  coupleNames: optStr(120),
});

const PixSettingsSchema = z.object({
  pixKey: optStr(77),
  pixKeyType: z
    .enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM", ""])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  pixHolderName: optStr(25),
  pixCity: optStr(15),
});

export async function updateSettings(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoManage();
  if (denied) return denied;
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

export async function updatePixSettings(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoManage();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = PixSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    await updateEventConfig({
      pixKey: parsed.data.pixKey,
      pixKeyType: parsed.data.pixKeyType,
      pixHolderName: parsed.data.pixHolderName,
      pixCity: parsed.data.pixCity,
    });
    await audit("EventSettings", "singleton", "UPDATE", { pix: true });
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/gifts");
    return { success: true };
  } catch (err) {
    console.error("[updatePixSettings]", err);
    return { success: false, error: "Erro ao salvar configurações Pix" };
  }
}

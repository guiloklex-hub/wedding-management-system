"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { denyIfNoEdit } from "@/lib/finance-access";
import type { ActionResult } from "@/types";

const Schema = z.object({
  rainPlanB: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  daySchedule: z
    .string()
    .trim()
    .max(8000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  daySpecialNotes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function updateWeddingDay(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    await prisma.eventSettings.update({
      where: { id: "singleton" },
      data: {
        rainPlanB: parsed.data.rainPlanB,
        daySchedule: parsed.data.daySchedule,
        daySpecialNotes: parsed.data.daySpecialNotes,
      },
    });
    revalidatePath("/dashboard/wedding-day");
    return { success: true };
  } catch (err) {
    console.error("[updateWeddingDay]", err);
    return { success: false, error: "Erro ao salvar" };
  }
}

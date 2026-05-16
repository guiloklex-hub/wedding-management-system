"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { denyIfNoFinance } from "@/lib/finance-access";
import type { ActionResult } from "@/types";

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const GoalBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  targetAmount: z.coerce.number().min(0.01),
  targetDate: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  notes: optStr(500),
  isActive: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean().default(true)),
});

const GoalCreateSchema = GoalBaseSchema;
const GoalUpdateSchema = GoalBaseSchema.extend({ id: z.string().min(1) });

export async function createGoal(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = GoalCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const created = await prisma.savingsGoal.create({
      data: {
        name: parsed.data.name,
        targetAmount: parsed.data.targetAmount,
        targetDate: parsed.data.targetDate,
        notes: parsed.data.notes,
        isActive: parsed.data.isActive,
      },
    });
    await audit("Asset", created.id, "CREATE", { type: "SavingsGoal" });
    revalidatePath("/dashboard/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[createGoal]", err);
    return { success: false, error: "Erro ao criar meta" };
  }
}

export async function updateGoal(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = GoalUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const result = await prisma.savingsGoal.updateMany({
      where: { id: parsed.data.id, deletedAt: null },
      data: {
        name: parsed.data.name,
        targetAmount: parsed.data.targetAmount,
        targetDate: parsed.data.targetDate,
        notes: parsed.data.notes,
        isActive: parsed.data.isActive,
      },
    });
    if (result.count === 0) return { success: false, error: "Meta não encontrada" };
    revalidatePath("/dashboard/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[updateGoal]", err);
    return { success: false, error: "Erro ao atualizar meta" };
  }
}

export async function deleteGoal(goalId: string): Promise<ActionResult> {
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  try {
    const result = await prisma.savingsGoal.updateMany({
      where: { id: goalId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Meta não encontrada" };
    await prisma.asset.updateMany({
      where: { goalId, deletedAt: null },
      data: { goalId: null },
    });
    revalidatePath("/dashboard/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[deleteGoal]", err);
    return { success: false, error: "Erro ao excluir meta" };
  }
}

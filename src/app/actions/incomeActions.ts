"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { denyIfNoFinance } from "@/lib/finance-access";
import type { ActionResult } from "@/types";

const SourceSchema = z.enum(["SALARY", "BONUS", "GIFT", "FREELANCE", "SALE", "RESTITUTION", "OTHER"]);
const StatusSchema = z.enum(["EXPECTED", "RECEIVED", "CANCELLED"]);
const FrequencySchema = z.enum(["ONE_TIME", "MONTHLY"]);

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const IncomeBaseSchema = z.object({
  title: z.string().trim().min(1).max(160),
  source: SourceSchema.default("SALARY"),
  amount: z.coerce.number().min(0.01),
  expectedDate: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  status: StatusSchema.default("EXPECTED"),
  frequency: FrequencySchema.default("ONE_TIME"),
  givenByName: optStr(120),
  notes: optStr(500),
});

const IncomeCreateSchema = IncomeBaseSchema;
const IncomeUpdateSchema = IncomeBaseSchema.extend({ id: z.string().min(1) });

export async function createIncome(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = IncomeCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const now = new Date();
    const created = await prisma.income.create({
      data: {
        title: parsed.data.title,
        source: parsed.data.source,
        amount: parsed.data.amount,
        expectedDate: parsed.data.expectedDate,
        status: parsed.data.status,
        frequency: parsed.data.frequency,
        givenByName: parsed.data.givenByName,
        notes: parsed.data.notes,
        receivedAt: parsed.data.status === "RECEIVED" ? now : null,
      },
    });
    await audit("Income", created.id, "CREATE", { amount: created.amount, source: created.source });
    revalidatePath("/dashboard/income");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[createIncome]", err);
    return { success: false, error: "Erro ao criar receita" };
  }
}

export async function updateIncome(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = IncomeUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const existing = await prisma.income.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
    });
    if (!existing) return { success: false, error: "Receita não encontrada" };

    const receivedAt =
      parsed.data.status === "RECEIVED" ? existing.receivedAt ?? new Date() : null;

    await prisma.income.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        source: parsed.data.source,
        amount: parsed.data.amount,
        expectedDate: parsed.data.expectedDate,
        status: parsed.data.status,
        frequency: parsed.data.frequency,
        givenByName: parsed.data.givenByName,
        notes: parsed.data.notes,
        receivedAt,
      },
    });
    await audit("Income", parsed.data.id, "UPDATE", { amount: parsed.data.amount, status: parsed.data.status });
    revalidatePath("/dashboard/income");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[updateIncome]", err);
    return { success: false, error: "Erro ao atualizar receita" };
  }
}

export async function markIncomeReceived(incomeId: string): Promise<ActionResult> {
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  try {
    const result = await prisma.income.updateMany({
      where: { id: incomeId, deletedAt: null },
      data: { status: "RECEIVED", receivedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Receita não encontrada" };
    await audit("Income", incomeId, "STATUS_CHANGE", { status: "RECEIVED" });
    revalidatePath("/dashboard/income");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[markIncomeReceived]", err);
    return { success: false, error: "Erro ao marcar como recebida" };
  }
}

export async function deleteIncome(incomeId: string): Promise<ActionResult> {
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  try {
    const result = await prisma.income.updateMany({
      where: { id: incomeId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Receita não encontrada" };
    await audit("Income", incomeId, "DELETE");
    revalidatePath("/dashboard/income");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[deleteIncome]", err);
    return { success: false, error: "Erro ao excluir receita" };
  }
}

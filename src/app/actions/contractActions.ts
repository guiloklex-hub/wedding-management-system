"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { denyIfNoEdit } from "@/lib/finance-access";
import type { ActionResult } from "@/types";

const ContractStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "NEGOTIATING",
  "SIGNED_DIGITAL",
  "SIGNED_PHYSICAL",
  "CANCELLED",
]);

const ContractBaseSchema = z.object({
  vendorId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  status: ContractStatusSchema.default("DRAFT"),
  signedAt: z.string().optional().transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  expiresAt: z.string().optional().transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  totalValue: z.coerce.number().min(0).optional().transform((v) => (v != null && !Number.isNaN(v) ? v : null)),
  paymentTerms: z.string().trim().max(2000).optional().transform((v) => (v && v.length > 0 ? v : null)),
  cancellationPolicy: z.string().trim().max(2000).optional().transform((v) => (v && v.length > 0 ? v : null)),
  includedItems: z.string().trim().max(4000).optional().transform((v) => (v && v.length > 0 ? v : null)),
  excludedItems: z.string().trim().max(4000).optional().transform((v) => (v && v.length > 0 ? v : null)),
  notes: z.string().trim().max(2000).optional().transform((v) => (v && v.length > 0 ? v : null)),
});

const ContractCreateSchema = ContractBaseSchema;
const ContractUpdateSchema = ContractBaseSchema.extend({
  id: z.string().min(1),
  version: z.coerce.number().int().min(1).max(99).optional(),
});

export async function createContract(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = ContractCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const existingVersionCount = await prisma.contract.count({
      where: { vendorId: parsed.data.vendorId, deletedAt: null },
    });
    const created = await prisma.contract.create({
      data: {
        vendorId: parsed.data.vendorId,
        title: parsed.data.title,
        status: parsed.data.status,
        signedAt: parsed.data.signedAt,
        expiresAt: parsed.data.expiresAt,
        totalValue: parsed.data.totalValue,
        paymentTerms: parsed.data.paymentTerms,
        cancellationPolicy: parsed.data.cancellationPolicy,
        includedItems: parsed.data.includedItems,
        excludedItems: parsed.data.excludedItems,
        notes: parsed.data.notes,
        version: existingVersionCount + 1,
      },
    });
    await audit("Vendor", parsed.data.vendorId, "UPDATE", { addedContract: created.id });
    revalidatePath(`/dashboard/vendors/${parsed.data.vendorId}`);
    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("[createContract]", err);
    return { success: false, error: "Erro ao criar contrato" };
  }
}

export async function updateContract(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = ContractUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const result = await prisma.contract.updateMany({
      where: { id: parsed.data.id, vendorId: parsed.data.vendorId, deletedAt: null },
      data: {
        title: parsed.data.title,
        status: parsed.data.status,
        signedAt: parsed.data.signedAt,
        expiresAt: parsed.data.expiresAt,
        totalValue: parsed.data.totalValue,
        paymentTerms: parsed.data.paymentTerms,
        cancellationPolicy: parsed.data.cancellationPolicy,
        includedItems: parsed.data.includedItems,
        excludedItems: parsed.data.excludedItems,
        notes: parsed.data.notes,
        version: parsed.data.version ?? undefined,
      },
    });
    if (result.count === 0) return { success: false, error: "Contrato não encontrado" };
    revalidatePath(`/dashboard/vendors/${parsed.data.vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[updateContract]", err);
    return { success: false, error: "Erro ao atualizar contrato" };
  }
}

export async function deleteContract(contractId: string, vendorId: string): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.contract.updateMany({
      where: { id: contractId, vendorId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Contrato não encontrado" };
    revalidatePath(`/dashboard/vendors/${vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteContract]", err);
    return { success: false, error: "Erro ao excluir contrato" };
  }
}

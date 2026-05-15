"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/types";

const VendorCreateSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  category: z.string().trim().min(1, "Categoria é obrigatória").max(80),
  categoryKey: z.string().trim().max(40).optional().nullable(),
  status: z.enum(["NEGOTIATION", "CONTRACTED", "FINALIZED"]),
  contractLink: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  estimatedValue: z.coerce.number().min(0, "Valor estimado deve ser positivo"),
});

const VendorUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  categoryKey: z.string().trim().max(40).optional().nullable(),
  status: z.enum(["NEGOTIATION", "CONTRACTED", "FINALIZED"]),
  contractLink: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  estimatedValue: z.coerce.number().min(0).optional(),
  actualValue: z.coerce.number().min(0).optional().nullable(),
});

export async function createVendor(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const data = Object.fromEntries(formData.entries());
  const parsed = VendorCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const vendor = await prisma.$transaction(async (tx) => {
      const created = await tx.vendor.create({
        data: {
          name: parsed.data.name,
          category: parsed.data.category,
          categoryKey: parsed.data.categoryKey ?? null,
          status: parsed.data.status,
          contractLink: parsed.data.contractLink,
          notes: parsed.data.notes,
        },
      });
      await tx.budgetItem.create({
        data: {
          title: `Orçamento: ${parsed.data.name}`,
          estimatedValue: parsed.data.estimatedValue,
          vendorId: created.id,
        },
      });
      return created;
    });

    await audit("Vendor", vendor.id, "CREATE", { name: vendor.name, status: vendor.status });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/vendors");
    return { success: true, data: { id: vendor.id } };
  } catch (err) {
    console.error("[createVendor]", err);
    return { success: false, error: "Erro ao criar fornecedor" };
  }
}

export async function updateVendor(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const data = Object.fromEntries(formData.entries());
  const parsed = VendorUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vendor.update({
        where: { id: parsed.data.id },
        data: {
          name: parsed.data.name,
          category: parsed.data.category,
          categoryKey: parsed.data.categoryKey ?? null,
          status: parsed.data.status,
          contractLink: parsed.data.contractLink ?? null,
          notes: parsed.data.notes ?? null,
        },
      });

      if (parsed.data.estimatedValue !== undefined || parsed.data.actualValue !== undefined) {
        const items = await tx.budgetItem.findMany({
          where: { vendorId: parsed.data.id, deletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 1,
        });
        if (items.length > 0) {
          await tx.budgetItem.update({
            where: { id: items[0].id },
            data: {
              estimatedValue: parsed.data.estimatedValue ?? items[0].estimatedValue,
              actualValue:
                parsed.data.actualValue === undefined ? items[0].actualValue : parsed.data.actualValue,
            },
          });
        }
      }
    });

    await audit("Vendor", parsed.data.id, "UPDATE", { name: parsed.data.name });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/vendors");
    return { success: true };
  } catch (err) {
    console.error("[updateVendor]", err);
    return { success: false, error: "Erro ao atualizar fornecedor" };
  }
}

export async function updateVendorStatus(
  vendorId: string,
  status: "NEGOTIATION" | "CONTRACTED" | "FINALIZED",
  actualValue?: number,
): Promise<ActionResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.vendor.update({ where: { id: vendorId }, data: { status } });
      if (status === "CONTRACTED" && actualValue !== undefined && actualValue >= 0) {
        await tx.budgetItem.updateMany({
          where: { vendorId, deletedAt: null },
          data: { actualValue },
        });
      }
    });

    await audit("Vendor", vendorId, "STATUS_CHANGE", { status, actualValue });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/vendors");
    return { success: true };
  } catch (err) {
    console.error("[updateVendorStatus]", err);
    return { success: false, error: "Erro ao atualizar status" };
  }
}

export async function deleteVendor(vendorId: string): Promise<ActionResult> {
  try {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.vendor.update({ where: { id: vendorId }, data: { deletedAt: now } });
      await tx.budgetItem.updateMany({
        where: { vendorId, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.payment.updateMany({
        where: { vendorId, deletedAt: null },
        data: { deletedAt: now },
      });
    });

    await audit("Vendor", vendorId, "DELETE");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/vendors");
    revalidatePath("/dashboard/payments");
    return { success: true };
  } catch (err) {
    console.error("[deleteVendor]", err);
    return { success: false, error: "Erro ao excluir fornecedor" };
  }
}

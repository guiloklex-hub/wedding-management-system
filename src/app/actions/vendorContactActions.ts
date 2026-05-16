"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { denyIfNoEdit } from "@/lib/finance-access";
import type { ActionResult } from "@/types";

const PhoneSchema = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const EmailSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null));

const ContactBaseSchema = z.object({
  vendorId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(80).optional().transform((v) => (v && v.length > 0 ? v : null)),
  phone: PhoneSchema,
  email: EmailSchema,
  isPrimary: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean().default(false)),
});

const ContactCreateSchema = ContactBaseSchema;
const ContactUpdateSchema = ContactBaseSchema.extend({ id: z.string().min(1) });

async function ensurePrimaryUnique(tx: typeof prisma, vendorId: string, contactId?: string) {
  await tx.vendorContact.updateMany({
    where: {
      vendorId,
      isPrimary: true,
      deletedAt: null,
      ...(contactId ? { NOT: { id: contactId } } : {}),
    },
    data: { isPrimary: false },
  });
}

export async function createVendorContact(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = ContactCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const created = await prisma.$transaction(async (tx) => {
      if (parsed.data.isPrimary) {
        await ensurePrimaryUnique(tx as unknown as typeof prisma, parsed.data.vendorId);
      }
      return tx.vendorContact.create({
        data: {
          vendorId: parsed.data.vendorId,
          name: parsed.data.name,
          role: parsed.data.role,
          phone: parsed.data.phone,
          email: parsed.data.email,
          isPrimary: parsed.data.isPrimary,
        },
      });
    });
    await audit("Vendor", parsed.data.vendorId, "UPDATE", { addedContact: created.id });
    revalidatePath(`/dashboard/vendors/${parsed.data.vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[createVendorContact]", err);
    return { success: false, error: "Erro ao adicionar contato" };
  }
}

export async function updateVendorContact(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = ContactUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.data.isPrimary) {
        await ensurePrimaryUnique(tx as unknown as typeof prisma, parsed.data.vendorId, parsed.data.id);
      }
      await tx.vendorContact.updateMany({
        where: { id: parsed.data.id, vendorId: parsed.data.vendorId, deletedAt: null },
        data: {
          name: parsed.data.name,
          role: parsed.data.role,
          phone: parsed.data.phone,
          email: parsed.data.email,
          isPrimary: parsed.data.isPrimary,
        },
      });
    });
    revalidatePath(`/dashboard/vendors/${parsed.data.vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[updateVendorContact]", err);
    return { success: false, error: "Erro ao atualizar contato" };
  }
}

export async function deleteVendorContact(contactId: string, vendorId: string): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.vendorContact.updateMany({
      where: { id: contactId, vendorId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Contato não encontrado" };
    revalidatePath(`/dashboard/vendors/${vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteVendorContact]", err);
    return { success: false, error: "Erro ao excluir contato" };
  }
}

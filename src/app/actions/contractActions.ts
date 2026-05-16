"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { auth } from "@/auth";
import { denyIfNoEdit } from "@/lib/finance-access";
import { saveUpload } from "@/lib/storage";
import {
  assertAllowedForKind,
  assertMagicMatchesMime,
  assertSizeForKind,
  detectMagic,
  FileValidationError,
} from "@/lib/file-validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { canSignContract, canUploadContract } from "@/lib/permissions";
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

const SignContractSchema = z.object({
  contractId: z.string().min(1).max(64),
  vendorId: z.string().min(1).max(64),
  method: z.enum(["DIGITAL", "PHYSICAL"]),
  signedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function signContract(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id;
  if (!canSignContract(role)) return { success: false, error: "Sem permissão para assinar" };

  const parsed = SignContractSchema.safeParse({
    contractId: formData.get("contractId"),
    vendorId: formData.get("vendorId"),
    method: formData.get("method"),
    signedAt: formData.get("signedAt") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const status = parsed.data.method === "DIGITAL" ? "SIGNED_DIGITAL" : "SIGNED_PHYSICAL";
  const signedAt = parsed.data.signedAt ? new Date(parsed.data.signedAt + "T00:00:00.000Z") : new Date();

  try {
    const result = await prisma.contract.updateMany({
      where: {
        id: parsed.data.contractId,
        vendorId: parsed.data.vendorId,
        deletedAt: null,
      },
      data: { status, signedAt },
    });
    if (result.count === 0) return { success: false, error: "Contrato não encontrado" };

    await audit(
      "Contract",
      parsed.data.contractId,
      "SIGN",
      { method: parsed.data.method, signedAt: signedAt.toISOString() },
      userId,
    );
    revalidatePath(`/dashboard/vendors/${parsed.data.vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[signContract]", err);
    return { success: false, error: "Erro ao registrar assinatura" };
  }
}

const ReplaceContractFileSchema = z.object({
  contractId: z.string().min(1).max(64),
  vendorId: z.string().min(1).max(64),
});

export async function replaceContractFile(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id;
  if (!canUploadContract(role)) {
    return { success: false, error: "Sem permissão para enviar contrato" };
  }

  const ip = getClientIp(await headers());
  if (!rateLimit(`upload:${userId ?? "anon"}`, 10, 60_000).ok) {
    return { success: false, error: "Muitos uploads em sequência. Tente novamente em 1 minuto." };
  }
  if (!rateLimit(`upload:ip:${ip}`, 30, 60_000).ok) {
    return { success: false, error: "Limite de uploads excedido." };
  }

  const file = formData.get("file");
  const parsed = ReplaceContractFileSchema.safeParse({
    contractId: formData.get("contractId"),
    vendorId: formData.get("vendorId"),
  });
  if (!parsed.success) {
    return { success: false, error: "Destino inválido" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Arquivo obrigatório" };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: parsed.data.contractId, vendorId: parsed.data.vendorId, deletedAt: null },
  });
  if (!contract) return { success: false, error: "Contrato não encontrado" };

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    assertSizeForKind("CONTRACT", bytes.length);
    const detected = detectMagic(bytes);
    assertMagicMatchesMime(detected, file.type);
    assertAllowedForKind("CONTRACT", file.type);

    const existingActive = await prisma.attachment.count({
      where: { contractId: contract.id, kind: "CONTRACT", deletedAt: null },
    });
    const isFirstUpload = existingActive === 0;
    const nextVersion = isFirstUpload ? contract.version : contract.version + 1;
    const stored = await saveUpload(file, {
      ownerType: "CONTRACT",
      ownerId: contract.id,
      subdir: `v${nextVersion}`,
    });

    const result = await prisma.$transaction(async (tx) => {
      if (!isFirstUpload) {
        await tx.attachment.updateMany({
          where: {
            contractId: contract.id,
            kind: "CONTRACT",
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
      }

      const newAtt = await tx.attachment.create({
        data: {
          ownerType: "CONTRACT",
          ownerId: contract.id,
          vendorId: contract.vendorId,
          contractId: contract.id,
          kind: "CONTRACT",
          filename: stored.filename,
          mimeType: stored.mimeType,
          size: stored.size,
          storagePath: stored.storagePath,
          sha256Full: stored.sha256Full,
          version: nextVersion,
          uploadedById: userId ?? null,
        },
      });

      if (!isFirstUpload) {
        await tx.contract.update({
          where: { id: contract.id },
          data: { version: nextVersion },
        });
      }

      return newAtt;
    });

    await audit(
      "Contract",
      contract.id,
      isFirstUpload ? "UPLOAD" : "REPLACE",
      {
        fromVersion: contract.version,
        toVersion: nextVersion,
        newAttachmentId: result.id,
        sha256: stored.sha256Full.slice(0, 16),
      },
      userId,
    );
    revalidatePath(`/dashboard/vendors/${parsed.data.vendorId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof FileValidationError) {
      return { success: false, error: err.message };
    }
    console.error("[replaceContractFile]", err);
    return { success: false, error: "Erro ao enviar contrato" };
  }
}

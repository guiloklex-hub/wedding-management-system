"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { removeUpload, saveUpload } from "@/lib/storage";
import {
  detectMagic,
  assertMagicMatchesMime,
  assertAllowedForKind,
  assertSizeForKind,
  FileValidationError,
} from "@/lib/file-validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { auth } from "@/auth";
import {
  canUploadAttachmentKind,
  canViewAttachmentKind,
  canEdit,
  canManageContract,
} from "@/lib/permissions";
import type { ActionResult } from "@/types";

const ATTACHMENT_KINDS = [
  "CONTRACT",
  "INVOICE",
  "RECEIPT",
  "PROPOSAL",
  "ID_DOC",
  "PHOTO",
  "OTHER",
] as const;

const OWNER_TYPES = ["VENDOR", "CONTRACT", "VENUE"] as const;

const UploadInputSchema = z.object({
  ownerType: z.enum(OWNER_TYPES),
  ownerId: z.string().min(1).max(64),
  kind: z.enum(ATTACHMENT_KINDS),
});

export async function uploadAttachment(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id;

  const ip = getClientIp(await headers());
  if (!rateLimit(`upload:${userId ?? "anon"}`, 10, 60_000).ok) {
    return { success: false, error: "Muitos uploads em sequência. Tente novamente em 1 minuto." };
  }
  if (!rateLimit(`upload:ip:${ip}`, 30, 60_000).ok) {
    return { success: false, error: "Limite de uploads excedido." };
  }

  const file = formData.get("file");
  const parsed = UploadInputSchema.safeParse({
    ownerType: formData.get("ownerType"),
    ownerId: formData.get("ownerId"),
    kind: formData.get("kind") ?? "OTHER",
  });
  if (!parsed.success) {
    return { success: false, error: "Destino inválido" };
  }
  const { ownerType, ownerId, kind } = parsed.data;

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Arquivo obrigatório" };
  }

  if (!canUploadAttachmentKind(role, kind)) {
    return { success: false, error: "Sem permissão para este tipo de anexo" };
  }
  if (!canEdit(role)) {
    return { success: false, error: "Sem permissão para editar" };
  }

  let vendorId: string | null = null;
  let contractId: string | null = null;
  let venueId: string | null = null;

  if (ownerType === "VENDOR") {
    const v = await prisma.vendor.findFirst({ where: { id: ownerId, deletedAt: null } });
    if (!v) return { success: false, error: "Fornecedor não encontrado" };
    vendorId = v.id;
  } else if (ownerType === "CONTRACT") {
    const c = await prisma.contract.findFirst({ where: { id: ownerId, deletedAt: null } });
    if (!c) return { success: false, error: "Contrato não encontrado" };
    contractId = c.id;
    vendorId = c.vendorId;
  } else if (ownerType === "VENUE") {
    const v = await prisma.venue.findFirst({ where: { id: ownerId, deletedAt: null } });
    if (!v) return { success: false, error: "Local não encontrado" };
    venueId = v.id;
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    assertSizeForKind(kind, bytes.length);
    const detected = detectMagic(bytes);
    assertMagicMatchesMime(detected, file.type);
    assertAllowedForKind(kind, file.type);

    const stored = await saveUpload(file, {
      ownerType,
      ownerId,
      subdir: kind === "CONTRACT" ? "current" : undefined,
    });

    const created = await prisma.attachment.create({
      data: {
        ownerType,
        ownerId,
        vendorId,
        contractId,
        venueId,
        kind,
        filename: stored.filename,
        mimeType: stored.mimeType,
        size: stored.size,
        storagePath: stored.storagePath,
        sha256Full: stored.sha256Full,
        uploadedById: userId ?? null,
      },
    });

    await audit(
      "Attachment",
      created.id,
      "UPLOAD",
      { kind, contractId, vendorId, venueId, size: stored.size, sha256: stored.sha256Full.slice(0, 16) },
      userId,
    );

    if (vendorId) revalidatePath(`/dashboard/vendors/${vendorId}`);
    if (venueId) revalidatePath(`/dashboard/venues/${venueId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof FileValidationError) {
      return { success: false, error: err.message };
    }
    console.error("[uploadAttachment]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao enviar arquivo",
    };
  }
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id;

  if (!canEdit(role)) {
    return { success: false, error: "Sem permissão" };
  }

  try {
    const existing = await prisma.attachment.findFirst({
      where: { id: attachmentId, deletedAt: null },
    });
    if (!existing) return { success: false, error: "Anexo não encontrado" };

    if (existing.kind === "CONTRACT" && !canManageContract(role)) {
      return {
        success: false,
        error: "Apenas administrador, noivo ou noiva podem remover contratos.",
      };
    }

    if (!canViewAttachmentKind(role, existing.kind)) {
      return { success: false, error: "Sem permissão para este anexo" };
    }

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });

    await audit(
      "Attachment",
      attachmentId,
      "DELETE",
      { kind: existing.kind, contractId: existing.contractId, vendorId: existing.vendorId },
      userId,
    );

    if (existing.vendorId) revalidatePath(`/dashboard/vendors/${existing.vendorId}`);
    if (existing.venueId) revalidatePath(`/dashboard/venues/${existing.venueId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteAttachment]", err);
    return { success: false, error: "Erro ao excluir anexo" };
  }
}

void removeUpload;

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { removeUpload, saveUpload } from "@/lib/storage";
import { auth } from "@/auth";
import type { ActionResult } from "@/types";

const ATTACHMENT_KINDS = new Set([
  "CONTRACT",
  "INVOICE",
  "RECEIPT",
  "PROPOSAL",
  "ID_DOC",
  "PHOTO",
  "OTHER",
]);

const OWNER_TYPES = new Set(["VENDOR", "CONTRACT", "VENUE"]);

export async function uploadAttachment(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };

  const file = formData.get("file");
  const ownerType = String(formData.get("ownerType") ?? "");
  const ownerId = String(formData.get("ownerId") ?? "");
  const kind = String(formData.get("kind") ?? "OTHER");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Arquivo obrigatório" };
  }
  if (!OWNER_TYPES.has(ownerType) || !ownerId) {
    return { success: false, error: "Destino inválido" };
  }
  if (!ATTACHMENT_KINDS.has(kind)) {
    return { success: false, error: "Tipo inválido" };
  }

  let vendorId: string | null = null;
  let contractId: string | null = null;

  if (ownerType === "VENDOR") {
    const v = await prisma.vendor.findFirst({ where: { id: ownerId, deletedAt: null } });
    if (!v) return { success: false, error: "Fornecedor não encontrado" };
    vendorId = v.id;
  } else if (ownerType === "CONTRACT") {
    const c = await prisma.contract.findFirst({ where: { id: ownerId, deletedAt: null } });
    if (!c) return { success: false, error: "Contrato não encontrado" };
    contractId = c.id;
    vendorId = c.vendorId;
  }

  try {
    const stored = await saveUpload(file, { ownerType, ownerId });
    const created = await prisma.attachment.create({
      data: {
        ownerType,
        ownerId,
        vendorId,
        contractId,
        kind,
        filename: stored.filename,
        mimeType: stored.mimeType,
        size: stored.size,
        storagePath: stored.storagePath,
      },
    });
    await audit("Vendor", vendorId ?? ownerId, "UPDATE", { uploadedAttachment: created.id });

    if (vendorId) revalidatePath(`/dashboard/vendors/${vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[uploadAttachment]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao enviar arquivo",
    };
  }
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  try {
    const existing = await prisma.attachment.findFirst({
      where: { id: attachmentId, deletedAt: null },
    });
    if (!existing) return { success: false, error: "Anexo não encontrado" };

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });
    await removeUpload(existing.storagePath);

    if (existing.vendorId) revalidatePath(`/dashboard/vendors/${existing.vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteAttachment]", err);
    return { success: false, error: "Erro ao excluir anexo" };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { denyIfNoEdit } from "@/lib/finance-access";
import type { ActionResult } from "@/types";

const NoteSchema = z.object({
  vendorId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
  kind: z.enum(["NOTE", "NEGOTIATION_EVENT", "MEETING", "DECISION"]).default("NOTE"),
});

export async function createVendorNote(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = NoteSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    await prisma.vendorNote.create({
      data: {
        vendorId: parsed.data.vendorId,
        body: parsed.data.body,
        kind: parsed.data.kind,
      },
    });
    revalidatePath(`/dashboard/vendors/${parsed.data.vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[createVendorNote]", err);
    return { success: false, error: "Erro ao adicionar nota" };
  }
}

export async function deleteVendorNote(noteId: string, vendorId: string): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.vendorNote.updateMany({
      where: { id: noteId, vendorId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Nota não encontrada" };
    revalidatePath(`/dashboard/vendors/${vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteVendorNote]", err);
    return { success: false, error: "Erro ao excluir nota" };
  }
}

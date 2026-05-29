"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { denyIfNoEdit } from "@/lib/finance-access";
import { zodErrorMessage } from "@/lib/zod-i18n";
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
  const t = await getTranslations("actions.vendorNote");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = NoteSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
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
    return { success: false, error: t("errorCreate") };
  }
}

export async function deleteVendorNote(noteId: string, vendorId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.vendorNote");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.vendorNote.updateMany({
      where: { id: noteId, vendorId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: t("notFound") };
    revalidatePath(`/dashboard/vendors/${vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteVendorNote]", err);
    return { success: false, error: t("errorDelete") };
  }
}

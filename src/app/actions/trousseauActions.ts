"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { denyIfNoEdit } from "@/lib/finance-access";
import type { ActionResult } from "@/types";

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const RoomSchema = z.enum(["KITCHEN", "BATHROOM", "BEDROOM", "LIVING", "LAUNDRY", "ELECTRONICS", "OTHER"]);
const PrioritySchema = z.enum(["ESSENTIAL", "NICE_TO_HAVE", "LUXURY"]);
const StatusSchema = z.enum(["TO_BUY", "BOUGHT", "GIFTED"]);

const BaseSchema = z.object({
  title: z.string().trim().min(1).max(160),
  room: RoomSchema.default("OTHER"),
  priority: PrioritySchema.default("NICE_TO_HAVE"),
  status: StatusSchema.default("TO_BUY"),
  estimatedPrice: z.coerce.number().min(0).optional().transform((v) => (Number.isFinite(v) ? v : null)),
  actualPrice: z.coerce.number().min(0).optional().transform((v) => (Number.isFinite(v) ? v : null)),
  store: optStr(120),
  link: optStr(500),
  notes: optStr(500),
});

const CreateSchema = BaseSchema;
const UpdateSchema = BaseSchema.extend({ id: z.string().min(1) });

export async function createTrousseauItem(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const parsed = CreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    await prisma.trousseauItem.create({
      data: {
        title: parsed.data.title,
        room: parsed.data.room,
        priority: parsed.data.priority,
        status: parsed.data.status,
        estimatedPrice: parsed.data.estimatedPrice ?? null,
        actualPrice: parsed.data.actualPrice ?? null,
        store: parsed.data.store,
        link: parsed.data.link,
        notes: parsed.data.notes,
      },
    });
    revalidatePath("/dashboard/trousseau");
    return { success: true };
  } catch (err) {
    console.error("[createTrousseauItem]", err);
    return { success: false, error: "Erro ao adicionar" };
  }
}

export async function updateTrousseauItem(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const parsed = UpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const result = await prisma.trousseauItem.updateMany({
      where: { id: parsed.data.id, deletedAt: null },
      data: {
        title: parsed.data.title,
        room: parsed.data.room,
        priority: parsed.data.priority,
        status: parsed.data.status,
        estimatedPrice: parsed.data.estimatedPrice ?? null,
        actualPrice: parsed.data.actualPrice ?? null,
        store: parsed.data.store,
        link: parsed.data.link,
        notes: parsed.data.notes,
      },
    });
    if (result.count === 0) return { success: false, error: "Item não encontrado" };
    revalidatePath("/dashboard/trousseau");
    return { success: true };
  } catch (err) {
    console.error("[updateTrousseauItem]", err);
    return { success: false, error: "Erro ao atualizar" };
  }
}

export async function setTrousseauStatus(
  id: string,
  status: "TO_BUY" | "BOUGHT" | "GIFTED",
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.trousseauItem.updateMany({
      where: { id, deletedAt: null },
      data: { status },
    });
    if (result.count === 0) return { success: false, error: "Item não encontrado" };
    revalidatePath("/dashboard/trousseau");
    return { success: true };
  } catch (err) {
    console.error("[setTrousseauStatus]", err);
    return { success: false, error: "Erro ao atualizar status" };
  }
}

export async function deleteTrousseauItem(id: string): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.trousseauItem.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Item não encontrado" };
    revalidatePath("/dashboard/trousseau");
    return { success: true };
  } catch (err) {
    console.error("[deleteTrousseauItem]", err);
    return { success: false, error: "Erro ao excluir" };
  }
}

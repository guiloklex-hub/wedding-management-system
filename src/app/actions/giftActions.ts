"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { denyIfNoEdit } from "@/lib/finance-access";
import type { ActionResult } from "@/types";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const GiftBaseSchema = z.object({
  guestId: z.string().optional().transform((v) => (v && v.length > 0 ? v : null)),
  giverName: optStr(160),
  type: z.enum(["CASH", "ITEM"]).default("CASH"),
  amount: z.coerce.number().min(0).optional().transform((v) => (Number.isFinite(v) ? v : null)),
  description: optStr(500),
  notes: optStr(500),
  isHoneymoonShare: z.preprocess(
    (v) => v === "on" || v === true || v === "true",
    z.boolean().default(false),
  ),
  receivedAt: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? new Date(v) : new Date())),
});

const GiftCreateSchema = GiftBaseSchema;
const GiftUpdateSchema = GiftBaseSchema.extend({ id: z.string().min(1) });

export async function createGift(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = GiftCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    await prisma.gift.create({
      data: {
        guestId: parsed.data.guestId,
        giverName: parsed.data.giverName,
        type: parsed.data.type,
        amount: parsed.data.type === "CASH" ? parsed.data.amount ?? 0 : parsed.data.amount,
        description: parsed.data.description,
        notes: parsed.data.notes,
        isHoneymoonShare: parsed.data.isHoneymoonShare,
        receivedAt: parsed.data.receivedAt,
      },
    });
    revalidatePath("/dashboard/gifts");
    return { success: true };
  } catch (err) {
    console.error("[createGift]", err);
    return { success: false, error: "Erro ao registrar presente" };
  }
}

export async function updateGift(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = GiftUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const result = await prisma.gift.updateMany({
      where: { id: parsed.data.id, deletedAt: null },
      data: {
        guestId: parsed.data.guestId,
        giverName: parsed.data.giverName,
        type: parsed.data.type,
        amount: parsed.data.type === "CASH" ? parsed.data.amount ?? 0 : parsed.data.amount,
        description: parsed.data.description,
        notes: parsed.data.notes,
        isHoneymoonShare: parsed.data.isHoneymoonShare,
        receivedAt: parsed.data.receivedAt,
      },
    });
    if (result.count === 0) return { success: false, error: "Presente não encontrado" };
    revalidatePath("/dashboard/gifts");
    return { success: true };
  } catch (err) {
    console.error("[updateGift]", err);
    return { success: false, error: "Erro ao atualizar presente" };
  }
}

export async function markGiftThanked(giftId: string, thanked: boolean): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.gift.updateMany({
      where: { id: giftId, deletedAt: null },
      data: {
        status: thanked ? "THANKED" : "RECEIVED",
        thankedAt: thanked ? new Date() : null,
      },
    });
    if (result.count === 0) return { success: false, error: "Presente não encontrado" };
    revalidatePath("/dashboard/gifts");
    return { success: true };
  } catch (err) {
    console.error("[markGiftThanked]", err);
    return { success: false, error: "Erro ao atualizar" };
  }
}

export async function deleteGift(giftId: string): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.gift.updateMany({
      where: { id: giftId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Presente não encontrado" };
    revalidatePath("/dashboard/gifts");
    return { success: true };
  } catch (err) {
    console.error("[deleteGift]", err);
    return { success: false, error: "Erro ao excluir presente" };
  }
}

export async function markGiftAsPixReceived(
  giftId: string,
  alsoCreateAsset = false,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const gift = await prisma.gift.findFirst({
      where: { id: giftId, deletedAt: null },
    });
    if (!gift) return { success: false, error: "Presente não encontrado" };
    if (gift.pixPaidAt) return { success: false, error: "Pix já marcado como recebido" };

    const now = new Date();
    await prisma.$transaction(async (tx: TxClient) => {
      await tx.gift.update({
        where: { id: giftId },
        data: {
          pixPaidAt: now,
          status: "RECEIVED",
        },
      });

      if (alsoCreateAsset && gift.amount && gift.amount > 0) {
        await tx.asset.create({
          data: {
            title: `Pix de ${gift.giverName ?? "convidado"}${gift.isHoneymoonShare ? " (cota lua de mel)" : ""}`,
            amount: gift.amount,
            date: now,
            notes: `Gerado a partir do presente #${gift.id}`,
          },
        });
      }
    });

    revalidatePath("/dashboard/gifts");
    if (alsoCreateAsset) revalidatePath("/dashboard/assets");
    return { success: true };
  } catch (err) {
    console.error("[markGiftAsPixReceived]", err);
    return { success: false, error: "Erro ao marcar Pix recebido" };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { denyIfNoEdit, denyIfNoFinance } from "@/lib/finance-access";
import { money } from "@/lib/validation";
import { zodErrorMessage } from "@/lib/zod-i18n";
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
  amount: money.optional().transform((v) => (Number.isFinite(v) ? v : null)),
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
  const t = await getTranslations("actions.gift");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = GiftCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
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
    return { success: false, error: t("errorCreating") };
  }
}

export async function updateGift(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.gift");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = GiftUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
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
    if (result.count === 0) return { success: false, error: t("notFound") };
    revalidatePath("/dashboard/gifts");
    return { success: true };
  } catch (err) {
    console.error("[updateGift]", err);
    return { success: false, error: t("errorUpdating") };
  }
}

export async function markGiftThanked(giftId: string, thanked: boolean): Promise<ActionResult> {
  const t = await getTranslations("actions.gift");
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
    if (result.count === 0) return { success: false, error: t("notFound") };
    revalidatePath("/dashboard/gifts");
    return { success: true };
  } catch (err) {
    console.error("[markGiftThanked]", err);
    return { success: false, error: t("errorUpdatingShort") };
  }
}

export async function deleteGift(giftId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.gift");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.gift.updateMany({
      where: { id: giftId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: t("notFound") };
    revalidatePath("/dashboard/gifts");
    return { success: true };
  } catch (err) {
    console.error("[deleteGift]", err);
    return { success: false, error: t("errorDeleting") };
  }
}

export async function markGiftAsPixReceived(
  giftId: string,
  alsoCreateAsset = false,
): Promise<ActionResult> {
  const t = await getTranslations("actions.gift");
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  try {
    const gift = await prisma.gift.findFirst({
      where: { id: giftId, deletedAt: null },
    });
    if (!gift) return { success: false, error: t("notFound") };
    if (gift.pixPaidAt) return { success: false, error: t("pixAlreadyReceived") };

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
            title: t("assetTitle", {
              giver: gift.giverName ?? t("assetGuestFallback"),
              honeymoon: gift.isHoneymoonShare ? t("assetHoneymoonSuffix") : "",
            }),
            amount: gift.amount,
            date: now,
            notes: t("assetNotes", { id: gift.id }),
          },
        });
      }
    });

    await audit("Gift", giftId, "MARK_PIX_RECEIVED", {
      amount: gift.amount,
      alsoCreateAsset,
    });

    revalidatePath("/dashboard/gifts");
    if (alsoCreateAsset) revalidatePath("/dashboard/assets");
    return { success: true };
  } catch (err) {
    console.error("[markGiftAsPixReceived]", err);
    return { success: false, error: t("errorMarkingPix") };
  }
}

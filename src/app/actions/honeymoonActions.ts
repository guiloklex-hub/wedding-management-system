"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { denyIfNoEdit } from "@/lib/finance-access";
import { money } from "@/lib/validation";
import { zodErrorMessage } from "@/lib/zod-i18n";
import type { ActionResult } from "@/types";

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const HoneymoonSchema = z.object({
  destination: optStr(160),
  startDate: z.string().optional().transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  endDate: z.string().optional().transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  budget: money.optional().transform((v) => (Number.isFinite(v) ? v : null)),
  currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  notes: optStr(2000),
});

export async function ensureHoneymoon() {
  const denied = await denyIfNoEdit();
  if (denied) return null;
  return prisma.honeymoon.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export async function updateHoneymoon(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const t = await getTranslations("actions.honeymoon");
  const data = Object.fromEntries(formData.entries());
  const parsed = HoneymoonSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    await ensureHoneymoon();
    await prisma.honeymoon.update({
      where: { id: "singleton" },
      data: {
        destination: parsed.data.destination,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        budget: parsed.data.budget ?? null,
        currency: parsed.data.currency,
        notes: parsed.data.notes,
      },
    });
    revalidatePath("/dashboard/honeymoon");
    return { success: true };
  } catch (err) {
    console.error("[updateHoneymoon]", err);
    return { success: false, error: t("errorSaving") };
  }
}

const ItemKindSchema = z.enum(["FLIGHT", "HOTEL", "TRANSFER", "ACTIVITY", "DOCUMENT", "BAGGAGE", "OTHER"]);
const ItemStatusSchema = z.enum(["PLANNED", "BOOKED", "CONFIRMED", "PAID", "CANCELLED"]);

const ItemBaseSchema = z.object({
  kind: ItemKindSchema.default("ACTIVITY"),
  title: z.string().trim().min(1).max(160),
  vendor: optStr(120),
  startAt: z.string().optional().transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  endAt: z.string().optional().transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  amount: money.optional().transform((v) => (Number.isFinite(v) ? v : null)),
  currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  status: ItemStatusSchema.default("PLANNED"),
  confirmationNumber: optStr(80),
  notes: optStr(500),
});
const ItemCreateSchema = ItemBaseSchema;
const ItemUpdateSchema = ItemBaseSchema.extend({ id: z.string().min(1) });

export async function createHoneymoonItem(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const t = await getTranslations("actions.honeymoon");
  const parsed = ItemCreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    await ensureHoneymoon();
    await prisma.honeymoonItem.create({
      data: {
        honeymoonId: "singleton",
        kind: parsed.data.kind,
        title: parsed.data.title,
        vendor: parsed.data.vendor,
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
        amount: parsed.data.amount ?? null,
        currency: parsed.data.currency,
        status: parsed.data.status,
        confirmationNumber: parsed.data.confirmationNumber,
        notes: parsed.data.notes,
      },
    });
    revalidatePath("/dashboard/honeymoon");
    return { success: true };
  } catch (err) {
    console.error("[createHoneymoonItem]", err);
    return { success: false, error: t("errorAdding") };
  }
}

export async function updateHoneymoonItem(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const t = await getTranslations("actions.honeymoon");
  const parsed = ItemUpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    const result = await prisma.honeymoonItem.updateMany({
      where: { id: parsed.data.id, deletedAt: null },
      data: {
        kind: parsed.data.kind,
        title: parsed.data.title,
        vendor: parsed.data.vendor,
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
        amount: parsed.data.amount ?? null,
        currency: parsed.data.currency,
        status: parsed.data.status,
        confirmationNumber: parsed.data.confirmationNumber,
        notes: parsed.data.notes,
      },
    });
    if (result.count === 0) return { success: false, error: t("itemNotFound") };
    revalidatePath("/dashboard/honeymoon");
    return { success: true };
  } catch (err) {
    console.error("[updateHoneymoonItem]", err);
    return { success: false, error: t("errorUpdating") };
  }
}

export async function deleteHoneymoonItem(id: string): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const t = await getTranslations("actions.honeymoon");
  try {
    const result = await prisma.honeymoonItem.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: t("itemNotFound") };
    revalidatePath("/dashboard/honeymoon");
    return { success: true };
  } catch (err) {
    console.error("[deleteHoneymoonItem]", err);
    return { success: false, error: t("errorDeleting") };
  }
}

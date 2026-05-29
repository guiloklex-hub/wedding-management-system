"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { denyIfNoFinance } from "@/lib/finance-access";
import { money } from "@/lib/validation";
import { zodErrorMessage } from "@/lib/zod-i18n";
import type { ActionResult } from "@/types";

const AssetCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  amount: money.min(0.01),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goalId: z.string().optional().transform((v) => (v && v.length > 0 ? v : null)),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

const AssetUpdateSchema = AssetCreateSchema.extend({
  id: z.string().min(1),
});

export async function createAsset(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.asset");
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = AssetCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }

  try {
    const created = await prisma.asset.create({
      data: {
        title: parsed.data.title,
        amount: parsed.data.amount,
        date: new Date(parsed.data.date),
        goalId: parsed.data.goalId ?? null,
        notes: parsed.data.notes,
      },
    });
    await audit("Asset", created.id, "CREATE", { amount: created.amount });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/assets");
    return { success: true };
  } catch (err) {
    console.error("[createAsset]", err);
    return { success: false, error: t("errorCreate") };
  }
}

export async function updateAsset(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.asset");
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = AssetUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }

  try {
    const result = await prisma.asset.updateMany({
      where: { id: parsed.data.id, deletedAt: null },
      data: {
        title: parsed.data.title,
        amount: parsed.data.amount,
        date: new Date(parsed.data.date),
        goalId: parsed.data.goalId ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
    if (result.count === 0) return { success: false, error: t("notFound") };

    await audit("Asset", parsed.data.id, "UPDATE");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/assets");
    return { success: true };
  } catch (err) {
    console.error("[updateAsset]", err);
    return { success: false, error: t("errorUpdate") };
  }
}

export async function deleteAsset(assetId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.asset");
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  try {
    const result = await prisma.asset.updateMany({
      where: { id: assetId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: t("notFound") };

    await audit("Asset", assetId, "DELETE");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/assets");
    return { success: true };
  } catch (err) {
    console.error("[deleteAsset]", err);
    return { success: false, error: t("errorDelete") };
  }
}

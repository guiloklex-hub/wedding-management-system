"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { DEFAULT_VENUE_CHECKLIST } from "@/lib/venue-checklist";
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

const VenueBaseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: optStr(300),
  mapsUrl: optStr(500),
  capacitySeated: z.coerce.number().int().min(0).optional().transform((v) => (Number.isFinite(v) ? v : null)),
  capacityStanding: z.coerce.number().int().min(0).optional().transform((v) => (Number.isFinite(v) ? v : null)),
  baseRate: money.optional().transform((v) => (Number.isFinite(v) ? v : null)),
  pricingNotes: optStr(2000),
  restrictions: optStr(2000),
  pros: optStr(2000),
  cons: optStr(2000),
  contactName: optStr(120),
  contactPhone: optStr(40),
  visitedAt: z.string().optional().transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  isShortlisted: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean().default(false)),
  notes: optStr(2000),
});

const VenueCreateSchema = VenueBaseSchema.extend({
  seedChecklist: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean().default(true)),
});
const VenueUpdateSchema = VenueBaseSchema.extend({ id: z.string().min(1) });

export async function createVenue(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("actions.venue");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = VenueCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    const created = await prisma.$transaction(async (tx) => {
      const venue = await tx.venue.create({
        data: {
          name: parsed.data.name,
          address: parsed.data.address,
          mapsUrl: parsed.data.mapsUrl,
          capacitySeated: parsed.data.capacitySeated ?? null,
          capacityStanding: parsed.data.capacityStanding ?? null,
          baseRate: parsed.data.baseRate ?? null,
          pricingNotes: parsed.data.pricingNotes,
          restrictions: parsed.data.restrictions,
          pros: parsed.data.pros,
          cons: parsed.data.cons,
          contactName: parsed.data.contactName,
          contactPhone: parsed.data.contactPhone,
          visitedAt: parsed.data.visitedAt,
          isShortlisted: parsed.data.isShortlisted,
          notes: parsed.data.notes,
        },
      });

      if (parsed.data.seedChecklist) {
        await tx.venueChecklistItem.createMany({
          data: DEFAULT_VENUE_CHECKLIST.map((label, idx) => ({
            venueId: venue.id,
            label,
            sortOrder: idx,
          })),
        });
      }

      return venue;
    });

    await audit("Vendor", created.id, "CREATE", { entity: "Venue", id: created.id });
    revalidatePath("/dashboard/venues");
    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("[createVenue]", err);
    return { success: false, error: t("errorCreate") };
  }
}

export async function updateVenue(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.venue");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = VenueUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    const result = await prisma.venue.updateMany({
      where: { id: parsed.data.id, deletedAt: null },
      data: {
        name: parsed.data.name,
        address: parsed.data.address,
        mapsUrl: parsed.data.mapsUrl,
        capacitySeated: parsed.data.capacitySeated ?? null,
        capacityStanding: parsed.data.capacityStanding ?? null,
        baseRate: parsed.data.baseRate ?? null,
        pricingNotes: parsed.data.pricingNotes,
        restrictions: parsed.data.restrictions,
        pros: parsed.data.pros,
        cons: parsed.data.cons,
        contactName: parsed.data.contactName,
        contactPhone: parsed.data.contactPhone,
        visitedAt: parsed.data.visitedAt,
        isShortlisted: parsed.data.isShortlisted,
        notes: parsed.data.notes,
      },
    });
    if (result.count === 0) return { success: false, error: t("notFound") };
    revalidatePath(`/dashboard/venues/${parsed.data.id}`);
    revalidatePath("/dashboard/venues");
    return { success: true };
  } catch (err) {
    console.error("[updateVenue]", err);
    return { success: false, error: t("errorUpdate") };
  }
}

export async function deleteVenue(venueId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.venue");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.venue.updateMany({
      where: { id: venueId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: t("notFound") };
    revalidatePath("/dashboard/venues");
    return { success: true };
  } catch (err) {
    console.error("[deleteVenue]", err);
    return { success: false, error: t("errorDelete") };
  }
}

const ChecklistAddSchema = z.object({
  venueId: z.string().min(1),
  label: z.string().trim().min(1).max(200),
});

export async function addChecklistItem(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.venue");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = ChecklistAddSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    const lastItem = await prisma.venueChecklistItem.findFirst({
      where: { venueId: parsed.data.venueId },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (lastItem?.sortOrder ?? -1) + 1;
    await prisma.venueChecklistItem.create({
      data: { venueId: parsed.data.venueId, label: parsed.data.label, sortOrder },
    });
    revalidatePath(`/dashboard/venues/${parsed.data.venueId}`);
    return { success: true };
  } catch (err) {
    console.error("[addChecklistItem]", err);
    return { success: false, error: t("errorAddItem") };
  }
}

export async function toggleChecklistItem(
  itemId: string,
  checked: boolean,
  value?: string,
): Promise<ActionResult> {
  const t = await getTranslations("actions.venue");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const item = await prisma.venueChecklistItem.update({
      where: { id: itemId },
      data: { checked, value: value && value.trim().length > 0 ? value.trim().slice(0, 500) : null },
    });
    revalidatePath(`/dashboard/venues/${item.venueId}`);
    return { success: true };
  } catch (err) {
    console.error("[toggleChecklistItem]", err);
    return { success: false, error: t("errorUpdateItem") };
  }
}

export async function deleteChecklistItem(itemId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.venue");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const item = await prisma.venueChecklistItem.findUnique({ where: { id: itemId } });
    if (!item) return { success: false, error: t("itemNotFound") };
    await prisma.venueChecklistItem.delete({ where: { id: itemId } });
    revalidatePath(`/dashboard/venues/${item.venueId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteChecklistItem]", err);
    return { success: false, error: t("errorDeleteItem") };
  }
}

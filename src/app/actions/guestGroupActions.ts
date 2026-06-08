"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { zodErrorMessage } from "@/lib/zod-i18n";
import { denyIfNoEdit } from "@/lib/finance-access";
import { notifyRsvpResponse } from "@/lib/notifications/rsvp";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/types";

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const PHONE_RE = /^[0-9+()\-\s]+$/;
const optPhone = (max: number) =>
  optStr(max).refine((v) => v === null || PHONE_RE.test(v), {
    params: { i18nKey: "zod.invalidPhone" },
  });

const GroupCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contactName: optStr(120),
  contactEmail: optStr(160),
  contactPhone: optPhone(40),
  notes: optStr(500),
});

const GroupUpdateSchema = GroupCreateSchema.extend({
  id: z.string().min(1).max(64),
});

export async function createGuestGroup(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.guestGroup");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const data = Object.fromEntries(formData.entries());
  const parsed = GroupCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    const created = await prisma.guestGroup.create({ data: parsed.data });
    await audit("GuestGroup", created.id, "CREATE", { name: created.name });
    revalidatePath("/dashboard/guests/groups");
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[createGuestGroup]", err);
    return { success: false, error: t("errorCreating") };
  }
}

export async function updateGuestGroup(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.guestGroup");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const data = Object.fromEntries(formData.entries());
  const parsed = GroupUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    const { id, ...rest } = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.guestGroup.updateMany({
        where: { id, deletedAt: null },
        data: rest,
      });
      if (updated.count > 0) {
        await tx.guest.updateMany({ where: { groupId: id }, data: { groupName: rest.name } });
      }
      return updated;
    });
    if (result.count === 0) return { success: false, error: t("notFound") };
    await audit("GuestGroup", id, "UPDATE", { name: rest.name });
    revalidatePath("/dashboard/guests/groups");
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[updateGuestGroup]", err);
    return { success: false, error: t("errorUpdating") };
  }
}

export async function deleteGuestGroup(groupId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.guestGroup");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  if (typeof groupId !== "string" || groupId.length === 0 || groupId.length > 64) {
    return { success: false, error: t("invalidId") };
  }
  try {
    await prisma.$transaction([
      prisma.guest.updateMany({ where: { groupId }, data: { groupId: null, groupName: null } }),
      prisma.guestGroup.updateMany({ where: { id: groupId }, data: { deletedAt: new Date() } }),
    ]);
    await audit("GuestGroup", groupId, "DELETE");
    revalidatePath("/dashboard/guests/groups");
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[deleteGuestGroup]", err);
    return { success: false, error: t("errorDeleting") };
  }
}

const GroupMembershipSchema = z.object({
  groupId: z.string().min(1).max(64),
  guestIds: z.array(z.string().min(1).max(64)).max(200),
});

export async function setGroupMembers(input: {
  groupId: string;
  guestIds: string[];
}): Promise<ActionResult> {
  const t = await getTranslations("actions.guestGroup");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const parsed = GroupMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    const group = await prisma.guestGroup.findFirst({
      where: { id: parsed.data.groupId, deletedAt: null },
      select: { name: true },
    });
    if (!group) return { success: false, error: t("notFound") };
    await prisma.$transaction([
      prisma.guest.updateMany({
        where: { groupId: parsed.data.groupId },
        data: { groupId: null, groupName: null },
      }),
      ...(parsed.data.guestIds.length > 0
        ? [
            prisma.guest.updateMany({
              where: { id: { in: parsed.data.guestIds } },
              data: { groupId: parsed.data.groupId, groupName: group.name },
            }),
          ]
        : []),
    ]);
    await audit("GuestGroup", parsed.data.groupId, "UPDATE", {
      members: parsed.data.guestIds.length,
    });
    revalidatePath("/dashboard/guests/groups");
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[setGroupMembers]", err);
    return { success: false, error: t("errorUpdatingMembers") };
  }
}

const GroupResponseSchema = z.object({
  token: z.string().trim().min(1).max(64),
  responses: z
    .array(
      z.object({
        guestId: z.string().min(1).max(64),
        status: z.enum(["CONFIRMED", "DECLINED", "MAYBE"]),
        plusOnesConfirmed: z.number().int().min(0).max(10).default(0),
        dietary: z.string().max(200).optional().nullable(),
      }),
    )
    .min(1)
    .max(200),
  notes: z.string().max(500).optional().nullable(),
});

export async function publicRsvpRespondForGroup(input: {
  token: string;
  responses: Array<{
    guestId: string;
    status: "CONFIRMED" | "DECLINED" | "MAYBE";
    plusOnesConfirmed?: number;
    dietary?: string | null;
  }>;
  notes?: string | null;
}): Promise<ActionResult<{ groupName: string; count: number }>> {
  const t = await getTranslations("actions.guestGroup");
  const ip = getClientIp(await headers());
  const rl = rateLimit(`rsvp:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return { success: false, error: t("tooManyAttempts") };
  }
  const normalized = {
    token: input.token,
    notes: input.notes ?? null,
    responses: input.responses.map((r) => ({
      guestId: r.guestId,
      status: r.status,
      plusOnesConfirmed: r.plusOnesConfirmed ?? 0,
      dietary: r.dietary ?? null,
    })),
  };
  const parsed = GroupResponseSchema.safeParse(normalized);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }

  try {
    const group = await prisma.guestGroup.findFirst({
      where: { rsvpToken: parsed.data.token, deletedAt: null },
      include: {
        guests: {
          where: { deletedAt: null },
          select: { id: true, plusOnesAllowed: true },
        },
      },
    });
    if (!group) return { success: false, error: t("groupInviteNotFound") };
    if (group.rsvpTokenExpiresAt && group.rsvpTokenExpiresAt.getTime() < Date.now()) {
      return { success: false, error: t("linkExpired") };
    }

    const groupGuestIds = new Set(group.guests.map((g: { id: string }) => g.id));
    const plusAllowedById = new Map<string, number>(
      group.guests.map((g: { id: string; plusOnesAllowed: number }) => [g.id, g.plusOnesAllowed]),
    );

    // Anti-IDOR: reject responses containing guestId outside this group
    for (const r of parsed.data.responses) {
      if (!groupGuestIds.has(r.guestId)) {
        return { success: false, error: t("guestOutsideGroup") };
      }
    }

    const now = new Date();
    let confirmedCount = 0;
    let declinedCount = 0;
    let totalPlusOnes = 0;
    await prisma.$transaction(
      parsed.data.responses.map((r) => {
        const plusMax = plusAllowedById.get(r.guestId) ?? 0;
        const plus = r.status === "CONFIRMED" ? Math.min(r.plusOnesConfirmed, plusMax) : 0;
        if (r.status === "CONFIRMED") confirmedCount += 1;
        if (r.status === "DECLINED") declinedCount += 1;
        totalPlusOnes += plus;
        return prisma.guest.updateMany({
          where: { id: r.guestId, groupId: group.id, deletedAt: null },
          data: {
            rsvpStatus: r.status,
            rsvpRespondedAt: now,
            plusOnesConfirmed: plus,
            dietary: r.dietary ?? undefined,
          },
        });
      }),
    );

    if (parsed.data.notes) {
      await prisma.guestGroup.update({
        where: { id: group.id },
        data: { notes: parsed.data.notes },
      });
    }

    await audit("GuestGroup", group.id, "RSVP_GROUP_RESPOND", {
      count: parsed.data.responses.length,
    });
    revalidatePath("/dashboard/guests");
    revalidatePath("/dashboard/guests/groups");

    const groupStatus =
      confirmedCount > 0 && declinedCount === 0
        ? "CONFIRMED"
        : declinedCount > 0 && confirmedCount === 0
          ? "DECLINED"
          : "PARTIAL";
    void notifyRsvpResponse({
      refType: "GuestGroup",
      refId: group.id,
      guestName: group.name,
      rsvpStatus: groupStatus,
      plusOnes: totalPlusOnes,
    });

    return {
      success: true,
      data: { groupName: group.name, count: parsed.data.responses.length },
    };
  } catch (err) {
    console.error("[publicRsvpRespondForGroup]", err);
    return { success: false, error: t("errorRsvp") };
  }
}

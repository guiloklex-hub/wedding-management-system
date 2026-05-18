"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { denyIfNoEdit } from "@/lib/finance-access";
import type { ActionResult } from "@/types";

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const GroupCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contactName: optStr(120),
  contactEmail: optStr(160),
  contactPhone: optStr(40),
  notes: optStr(500),
});

const GroupUpdateSchema = GroupCreateSchema.extend({
  id: z.string().min(1).max(64),
});

export async function createGuestGroup(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const data = Object.fromEntries(formData.entries());
  const parsed = GroupCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const created = await prisma.guestGroup.create({ data: parsed.data });
    await audit("GuestGroup", created.id, "CREATE", { name: created.name });
    revalidatePath("/dashboard/guests/groups");
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[createGuestGroup]", err);
    return { success: false, error: "Erro ao criar grupo" };
  }
}

export async function updateGuestGroup(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const data = Object.fromEntries(formData.entries());
  const parsed = GroupUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const { id, ...rest } = parsed.data;
    const result = await prisma.guestGroup.updateMany({
      where: { id },
      data: rest,
    });
    if (result.count === 0) return { success: false, error: "Grupo não encontrado" };
    await audit("GuestGroup", id, "UPDATE", { name: rest.name });
    revalidatePath("/dashboard/guests/groups");
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[updateGuestGroup]", err);
    return { success: false, error: "Erro ao atualizar grupo" };
  }
}

export async function deleteGuestGroup(groupId: string): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  if (typeof groupId !== "string" || groupId.length === 0 || groupId.length > 64) {
    return { success: false, error: "ID inválido" };
  }
  try {
    await prisma.$transaction([
      prisma.guest.updateMany({ where: { groupId }, data: { groupId: null } }),
      prisma.guestGroup.updateMany({ where: { id: groupId }, data: { deletedAt: new Date() } }),
    ]);
    await audit("GuestGroup", groupId, "DELETE");
    revalidatePath("/dashboard/guests/groups");
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[deleteGuestGroup]", err);
    return { success: false, error: "Erro ao excluir grupo" };
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
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const parsed = GroupMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    await prisma.$transaction([
      prisma.guest.updateMany({
        where: { groupId: parsed.data.groupId },
        data: { groupId: null },
      }),
      ...(parsed.data.guestIds.length > 0
        ? [
            prisma.guest.updateMany({
              where: { id: { in: parsed.data.guestIds } },
              data: { groupId: parsed.data.groupId },
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
    return { success: false, error: "Erro ao atualizar membros" };
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
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const group = await prisma.guestGroup.findFirst({
      where: { rsvpToken: parsed.data.token },
      include: {
        guests: {
          select: { id: true, plusOnesAllowed: true },
        },
      },
    });
    if (!group) return { success: false, error: "Convite de grupo não encontrado" };
    if (group.rsvpTokenExpiresAt && group.rsvpTokenExpiresAt.getTime() < Date.now()) {
      return { success: false, error: "Link expirado. Solicite um novo convite." };
    }

    const groupGuestIds = new Set(group.guests.map((g: { id: string }) => g.id));
    const plusAllowedById = new Map<string, number>(
      group.guests.map((g: { id: string; plusOnesAllowed: number }) => [g.id, g.plusOnesAllowed]),
    );

    // Anti-IDOR: reject responses containing guestId outside this group
    for (const r of parsed.data.responses) {
      if (!groupGuestIds.has(r.guestId)) {
        return { success: false, error: "Resposta inválida (convidado fora do grupo)" };
      }
    }

    const now = new Date();
    await prisma.$transaction(
      parsed.data.responses.map((r) => {
        const plusMax = plusAllowedById.get(r.guestId) ?? 0;
        const plus = r.status === "CONFIRMED" ? Math.min(r.plusOnesConfirmed, plusMax) : 0;
        return prisma.guest.updateMany({
          where: { id: r.guestId, groupId: group.id },
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

    return {
      success: true,
      data: { groupName: group.name, count: parsed.data.responses.length },
    };
  } catch (err) {
    console.error("[publicRsvpRespondForGroup]", err);
    return { success: false, error: "Erro ao registrar respostas" };
  }
}

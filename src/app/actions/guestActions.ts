"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { denyIfNoEdit } from "@/lib/finance-access";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/types";

const RsvpStatusSchema = z.enum(["NOT_INVITED", "INVITED", "CONFIRMED", "DECLINED", "MAYBE"]);

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const GuestBaseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: optStr(40),
  email: optStr(160),
  side: z.enum(["NOIVO", "NOIVA", "AMBOS"]).optional().nullable(),
  groupName: optStr(80),
  rsvpStatus: RsvpStatusSchema.default("INVITED"),
  plusOnesAllowed: z.coerce.number().int().min(0).max(10).default(0),
  isChild: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean().default(false)),
  isVIP: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean().default(false)),
  isPadrinho: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean().default(false)),
  dietary: optStr(200),
  tableNumber: optStr(20),
  city: optStr(80),
  notes: optStr(500),
});

const GuestCreateSchema = GuestBaseSchema;
const GuestUpdateSchema = GuestBaseSchema.extend({ id: z.string().min(1) });

export async function createGuest(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = GuestCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const created = await prisma.guest.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        side: parsed.data.side ?? null,
        groupName: parsed.data.groupName,
        rsvpStatus: parsed.data.rsvpStatus,
        plusOnesAllowed: parsed.data.plusOnesAllowed,
        isChild: parsed.data.isChild,
        isVIP: parsed.data.isVIP,
        isPadrinho: parsed.data.isPadrinho,
        dietary: parsed.data.dietary,
        tableNumber: parsed.data.tableNumber,
        city: parsed.data.city,
        notes: parsed.data.notes,
      },
    });
    await audit("Asset", created.id, "CREATE", { entity: "Guest" });
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[createGuest]", err);
    return { success: false, error: "Erro ao criar convidado" };
  }
}

export async function updateGuest(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = GuestUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const result = await prisma.guest.updateMany({
      where: { id: parsed.data.id, deletedAt: null },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        side: parsed.data.side ?? null,
        groupName: parsed.data.groupName,
        rsvpStatus: parsed.data.rsvpStatus,
        plusOnesAllowed: parsed.data.plusOnesAllowed,
        isChild: parsed.data.isChild,
        isVIP: parsed.data.isVIP,
        isPadrinho: parsed.data.isPadrinho,
        dietary: parsed.data.dietary,
        tableNumber: parsed.data.tableNumber,
        city: parsed.data.city,
        notes: parsed.data.notes,
      },
    });
    if (result.count === 0) return { success: false, error: "Convidado não encontrado" };
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[updateGuest]", err);
    return { success: false, error: "Erro ao atualizar convidado" };
  }
}

export async function deleteGuest(guestId: string): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.guest.updateMany({
      where: { id: guestId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Convidado não encontrado" };
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[deleteGuest]", err);
    return { success: false, error: "Erro ao excluir convidado" };
  }
}

export async function toggleCheckin(guestId: string, present: boolean): Promise<ActionResult> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.guest.updateMany({
      where: { id: guestId, deletedAt: null },
      data: { checkedInAt: present ? new Date() : null },
    });
    if (result.count === 0) return { success: false, error: "Convidado não encontrado" };
    revalidatePath("/dashboard/guests");
    revalidatePath("/dashboard/wedding-day");
    return { success: true };
  } catch (err) {
    console.error("[toggleCheckin]", err);
    return { success: false, error: "Erro ao registrar presença" };
  }
}

const ImportSchema = z.object({
  raw: z.string().trim().min(1).max(50_000),
  separator: z.enum(["AUTO", "TAB", "COMMA", "SEMICOLON"]).default("AUTO"),
});

function detectSeparator(firstLine: string): "\t" | "," | ";" {
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  if (tabCount >= commaCount && tabCount >= semiCount) return "\t";
  if (semiCount > commaCount) return ";";
  return ",";
}

export async function bulkImportGuests(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ created: number; skipped: number }>> {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = ImportSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const lines = parsed.data.raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { success: false, error: "Nenhuma linha encontrada" };

  const sep =
    parsed.data.separator === "TAB"
      ? "\t"
      : parsed.data.separator === "COMMA"
        ? ","
        : parsed.data.separator === "SEMICOLON"
          ? ";"
          : detectSeparator(lines[0]);

  let created = 0;
  let skipped = 0;
  try {
    for (const line of lines) {
      const parts = line.split(sep).map((p) => p.trim());
      const [name, phone, email, side, groupName] = parts;
      if (!name) {
        skipped++;
        continue;
      }
      await prisma.guest.create({
        data: {
          name,
          phone: phone || null,
          email: email || null,
          side: side === "NOIVO" || side === "NOIVA" || side === "AMBOS" ? side : null,
          groupName: groupName || null,
        },
      });
      created++;
    }
    revalidatePath("/dashboard/guests");
    return { success: true, data: { created, skipped } };
  } catch (err) {
    console.error("[bulkImportGuests]", err);
    return { success: false, error: "Erro ao importar" };
  }
}

const RsvpPublicSchema = z.object({
  token: z.string().min(1),
  status: z.enum(["CONFIRMED", "DECLINED", "MAYBE"]),
  plusOnesConfirmed: z.coerce.number().int().min(0).max(10).default(0),
  dietary: optStr(200),
  notes: optStr(500),
});

export async function publicRsvpRespond(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ name: string; status: string }>> {
  const ip = getClientIp(await headers());
  const rl = rateLimit(`rsvp:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return { success: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };
  }
  const data = Object.fromEntries(formData.entries());
  const parsed = RsvpPublicSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const guest = await prisma.guest.findFirst({
      where: { rsvpToken: parsed.data.token, deletedAt: null },
    });
    if (!guest) return { success: false, error: "Convite não encontrado" };

    const plus = Math.min(parsed.data.plusOnesConfirmed, guest.plusOnesAllowed);
    const updated = await prisma.guest.update({
      where: { id: guest.id },
      data: {
        rsvpStatus: parsed.data.status,
        rsvpRespondedAt: new Date(),
        plusOnesConfirmed: parsed.data.status === "CONFIRMED" ? plus : 0,
        dietary: parsed.data.dietary ?? guest.dietary,
        notes: parsed.data.notes ?? guest.notes,
      },
    });
    revalidatePath("/dashboard/guests");
    return { success: true, data: { name: updated.name, status: updated.rsvpStatus } };
  } catch (err) {
    console.error("[publicRsvpRespond]", err);
    return { success: false, error: "Erro ao registrar resposta" };
  }
}

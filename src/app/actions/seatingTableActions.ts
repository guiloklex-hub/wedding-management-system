"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/types";

const TableCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  capacity: z.coerce.number().int().min(1).max(50),
  shape: z.enum(["ROUND", "RECT", "SQUARE"]).default("ROUND"),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

const TableUpdateSchema = TableCreateSchema.extend({
  id: z.string().min(1).max(64),
});

export async function createSeatingTable(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };

  const data = Object.fromEntries(formData.entries());
  const parsed = TableCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const created = await prisma.seatingTable.create({
      data: {
        name: parsed.data.name,
        capacity: parsed.data.capacity,
        shape: parsed.data.shape,
        notes: parsed.data.notes,
      },
    });
    await audit("SeatingTable", created.id, "CREATE", { name: created.name, capacity: created.capacity });
    revalidatePath("/dashboard/wedding-day/seating");
    return { success: true };
  } catch (err) {
    console.error("[createSeatingTable]", err);
    return { success: false, error: "Erro ao criar mesa" };
  }
}

export async function updateSeatingTable(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };

  const data = Object.fromEntries(formData.entries());
  const parsed = TableUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const result = await prisma.seatingTable.updateMany({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        capacity: parsed.data.capacity,
        shape: parsed.data.shape,
        notes: parsed.data.notes,
      },
    });
    if (result.count === 0) return { success: false, error: "Mesa não encontrada" };
    await audit("SeatingTable", parsed.data.id, "UPDATE", { name: parsed.data.name });
    revalidatePath("/dashboard/wedding-day/seating");
    return { success: true };
  } catch (err) {
    console.error("[updateSeatingTable]", err);
    return { success: false, error: "Erro ao atualizar mesa" };
  }
}

export async function deleteSeatingTable(tableId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };

  if (typeof tableId !== "string" || tableId.length === 0 || tableId.length > 64) {
    return { success: false, error: "ID inválido" };
  }
  try {
    await prisma.$transaction([
      prisma.guest.updateMany({ where: { tableId }, data: { tableId: null } }),
      prisma.seatingTable.updateMany({
        where: { id: tableId },
        data: { deletedAt: new Date() },
      }),
    ]);
    await audit("SeatingTable", tableId, "DELETE");
    revalidatePath("/dashboard/wedding-day/seating");
    return { success: true };
  } catch (err) {
    console.error("[deleteSeatingTable]", err);
    return { success: false, error: "Erro ao excluir mesa" };
  }
}

export async function updateTablePosition(
  tableId: string,
  x: number,
  y: number,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };

  if (typeof tableId !== "string" || tableId.length === 0 || tableId.length > 64) {
    return { success: false, error: "ID inválido" };
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { success: false, error: "Coordenadas inválidas" };
  }
  try {
    const result = await prisma.seatingTable.updateMany({
      where: { id: tableId },
      data: { x, y },
    });
    if (result.count === 0) return { success: false, error: "Mesa não encontrada" };
    return { success: true };
  } catch (err) {
    console.error("[updateTablePosition]", err);
    return { success: false, error: "Erro ao mover mesa" };
  }
}

export async function assignGuestToTable(
  guestId: string,
  tableId: string | null,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };

  if (typeof guestId !== "string" || guestId.length === 0 || guestId.length > 64) {
    return { success: false, error: "ID de convidado inválido" };
  }
  if (tableId !== null && (typeof tableId !== "string" || tableId.length === 0 || tableId.length > 64)) {
    return { success: false, error: "ID de mesa inválido" };
  }

  try {
    if (tableId) {
      const [table, currentGuests] = await Promise.all([
        prisma.seatingTable.findUnique({ where: { id: tableId } }),
        prisma.guest.findMany({
          where: { tableId, deletedAt: null, NOT: { id: guestId } },
          select: { id: true, plusOnesConfirmed: true },
        }),
      ]);
      if (!table) return { success: false, error: "Mesa não encontrada" };
      const seatsUsed = currentGuests.reduce(
        (sum: number, g: { plusOnesConfirmed: number | null }) =>
          sum + 1 + (g.plusOnesConfirmed ?? 0),
        0,
      );
      const newGuest = await prisma.guest.findUnique({
        where: { id: guestId },
        select: { plusOnesConfirmed: true, deletedAt: true },
      });
      if (!newGuest || newGuest.deletedAt) return { success: false, error: "Convidado não encontrado" };
      const seatsNeeded = 1 + (newGuest.plusOnesConfirmed ?? 0);
      if (seatsUsed + seatsNeeded > table.capacity) {
        return {
          success: false,
          error: `Mesa "${table.name}" não tem assentos suficientes (capacidade ${table.capacity}, ocupados ${seatsUsed}, necessário ${seatsNeeded})`,
        };
      }
    }

    const result = await prisma.guest.updateMany({
      where: { id: guestId, deletedAt: null },
      data: { tableId },
    });
    if (result.count === 0) return { success: false, error: "Convidado não encontrado" };

    await audit(
      "Guest",
      guestId,
      tableId ? "ASSIGN_TABLE" : "UNASSIGN_TABLE",
      { tableId },
    );
    revalidatePath("/dashboard/wedding-day/seating");
    return { success: true };
  } catch (err) {
    console.error("[assignGuestToTable]", err);
    return { success: false, error: "Erro ao alocar convidado" };
  }
}

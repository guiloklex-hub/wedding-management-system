"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { denyIfNoEdit } from "@/lib/finance-access";
import { zodErrorMessage } from "@/lib/zod-i18n";
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
  const t = await getTranslations("actions.seatingTable");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const data = Object.fromEntries(formData.entries());
  const parsed = TableCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
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
    return { success: false, error: t("errorCreate") };
  }
}

export async function updateSeatingTable(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.seatingTable");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const data = Object.fromEntries(formData.entries());
  const parsed = TableUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
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
    if (result.count === 0) return { success: false, error: t("tableNotFound") };
    await audit("SeatingTable", parsed.data.id, "UPDATE", { name: parsed.data.name });
    revalidatePath("/dashboard/wedding-day/seating");
    return { success: true };
  } catch (err) {
    console.error("[updateSeatingTable]", err);
    return { success: false, error: t("errorUpdate") };
  }
}

export async function deleteSeatingTable(tableId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.seatingTable");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  if (typeof tableId !== "string" || tableId.length === 0 || tableId.length > 64) {
    return { success: false, error: t("invalidId") };
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
    return { success: false, error: t("errorDelete") };
  }
}

const ReorderSchema = z.array(z.string().min(1).max(64)).min(1).max(200);

export async function reorderSeatingTables(orderedIds: string[]): Promise<ActionResult> {
  const t = await getTranslations("actions.seatingTable");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const parsed = ReorderSchema.safeParse(orderedIds);
  if (!parsed.success) {
    return { success: false, error: t("invalidOrder") };
  }
  const ids = parsed.data;
  try {
    await prisma.$transaction(
      ids.map((id, i) =>
        prisma.seatingTable.updateMany({
          where: { id, deletedAt: null },
          data: { sortOrder: i },
        }),
      ),
    );
    await audit("SeatingTable", ids[0], "REORDER", { count: ids.length });
    revalidatePath("/dashboard/wedding-day/seating");
    return { success: true };
  } catch (err) {
    console.error("[reorderSeatingTables]", err);
    return { success: false, error: t("errorReorder") };
  }
}

export async function updateTablePosition(
  tableId: string,
  x: number,
  y: number,
): Promise<ActionResult> {
  const t = await getTranslations("actions.seatingTable");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  if (typeof tableId !== "string" || tableId.length === 0 || tableId.length > 64) {
    return { success: false, error: t("invalidId") };
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { success: false, error: t("invalidCoords") };
  }
  try {
    const result = await prisma.seatingTable.updateMany({
      where: { id: tableId },
      data: { x, y },
    });
    if (result.count === 0) return { success: false, error: t("tableNotFound") };
    return { success: true };
  } catch (err) {
    console.error("[updateTablePosition]", err);
    return { success: false, error: t("errorMove") };
  }
}

export async function assignGuestToTable(
  guestId: string,
  tableId: string | null,
): Promise<ActionResult> {
  const t = await getTranslations("actions.seatingTable");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  if (typeof guestId !== "string" || guestId.length === 0 || guestId.length > 64) {
    return { success: false, error: t("invalidGuestId") };
  }
  if (tableId !== null && (typeof tableId !== "string" || tableId.length === 0 || tableId.length > 64)) {
    return { success: false, error: t("invalidTableId") };
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      if (tableId) {
        const table = await tx.seatingTable.findUnique({ where: { id: tableId } });
        if (!table) return { ok: false as const, error: t("tableNotFound") };

        const currentGuests = await tx.guest.findMany({
          where: { tableId, deletedAt: null, NOT: { id: guestId } },
          select: { id: true, plusOnesConfirmed: true },
        });
        const seatsUsed = currentGuests.reduce(
          (sum, g) => sum + 1 + (g.plusOnesConfirmed ?? 0),
          0,
        );

        const newGuest = await tx.guest.findUnique({
          where: { id: guestId },
          select: { plusOnesConfirmed: true, deletedAt: true },
        });
        if (!newGuest || newGuest.deletedAt) {
          return { ok: false as const, error: t("guestNotFound") };
        }

        const seatsNeeded = 1 + (newGuest.plusOnesConfirmed ?? 0);
        if (seatsUsed + seatsNeeded > table.capacity) {
          return {
            ok: false as const,
            error: t("tableFull", {
              name: table.name,
              capacity: table.capacity,
              used: seatsUsed,
              needed: seatsNeeded,
            }),
          };
        }
      }

      const result = await tx.guest.updateMany({
        where: { id: guestId, deletedAt: null },
        data: { tableId },
      });
      if (result.count === 0) {
        return { ok: false as const, error: t("guestNotFound") };
      }
      return { ok: true as const };
    });

    if (!outcome.ok) return { success: false, error: outcome.error };

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
    return { success: false, error: t("errorAssign") };
  }
}

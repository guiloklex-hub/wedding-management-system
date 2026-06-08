"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { zodErrorMessage } from "@/lib/zod-i18n";
import { denyIfNoEdit } from "@/lib/finance-access";
import { notifyRsvpResponse } from "@/lib/notifications/rsvp";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  detectMagic,
  assertGuestImportSize,
  FileValidationError,
} from "@/lib/file-validation";
import {
  IMPORTERS,
  detectImporter,
  extractCsvRecords,
  extractXlsxRecords,
  type ExtractedSheet,
  type Importer,
  type ImporterId,
  type ParsedRow,
} from "@/lib/guest-importers";
import { putImport, consumeImport } from "@/lib/guest-import-cache";
import type { ActionResult } from "@/types";

const RsvpStatusSchema = z.enum(["NOT_INVITED", "INVITED", "CONFIRMED", "DECLINED", "MAYBE"]);

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

const GuestBaseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: optPhone(40),
  email: optStr(160),
  side: z.enum(["NOIVO", "NOIVA", "AMBOS"]).optional().nullable(),
  groupId: optStr(64),
  newGroupName: optStr(120),
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

/**
 * Resolve o grupo do convidado a partir do que o formulário enviou. Garante que o vínculo
 * real (`groupId`) e o espelho denormalizado (`groupName`) fiquem sempre consistentes.
 * Retorna `null` quando o `groupId` recebido não existe (ou foi removido).
 */
async function resolveGuestGroup(
  groupId: string | null,
  newGroupName: string | null,
): Promise<{ groupId: string | null; groupName: string | null } | null> {
  if (newGroupName) {
    const created = await prisma.guestGroup.create({ data: { name: newGroupName } });
    return { groupId: created.id, groupName: created.name };
  }
  const effectiveId = groupId && groupId !== "__new__" ? groupId : null;
  if (effectiveId) {
    const group = await prisma.guestGroup.findFirst({
      where: { id: effectiveId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!group) return null;
    return { groupId: group.id, groupName: group.name };
  }
  return { groupId: null, groupName: null };
}

export async function createGuest(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.guest");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = GuestCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  const group = await resolveGuestGroup(parsed.data.groupId, parsed.data.newGroupName);
  if (!group) return { success: false, error: t("notFound") };
  try {
    const created = await prisma.guest.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        side: parsed.data.side ?? null,
        groupId: group.groupId,
        groupName: group.groupName,
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
    await audit("Guest", created.id, "CREATE", { name: created.name });
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[createGuest]", err);
    return { success: false, error: t("errorCreating") };
  }
}

export async function updateGuest(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.guest");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = GuestUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  const group = await resolveGuestGroup(parsed.data.groupId, parsed.data.newGroupName);
  if (!group) return { success: false, error: t("notFound") };
  try {
    const result = await prisma.guest.updateMany({
      where: { id: parsed.data.id, deletedAt: null },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        side: parsed.data.side ?? null,
        groupId: group.groupId,
        groupName: group.groupName,
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
    if (result.count === 0) return { success: false, error: t("notFound") };
    await audit("Guest", parsed.data.id, "UPDATE", { name: parsed.data.name });
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[updateGuest]", err);
    return { success: false, error: t("errorUpdating") };
  }
}

export async function deleteGuest(guestId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.guest");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.guest.updateMany({
      where: { id: guestId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: t("notFound") };
    await audit("Guest", guestId, "DELETE");
    revalidatePath("/dashboard/guests");
    return { success: true };
  } catch (err) {
    console.error("[deleteGuest]", err);
    return { success: false, error: t("errorDeleting") };
  }
}

export async function toggleCheckin(guestId: string, present: boolean): Promise<ActionResult> {
  const t = await getTranslations("actions.guest");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  try {
    const result = await prisma.guest.updateMany({
      where: { id: guestId, deletedAt: null },
      data: { checkedInAt: present ? new Date() : null },
    });
    if (result.count === 0) return { success: false, error: t("notFound") };
    await audit("Guest", guestId, "STATUS_CHANGE", { checkedIn: present });
    revalidatePath("/dashboard/guests");
    revalidatePath("/dashboard/wedding-day");
    return { success: true };
  } catch (err) {
    console.error("[toggleCheckin]", err);
    return { success: false, error: t("errorCheckin") };
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
): Promise<ActionResult<{ created: number; skipped: number; groupsCreated: number }>> {
  const t = await getTranslations("actions.guest");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const data = Object.fromEntries(formData.entries());
  const parsed = ImportSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }

  const lines = parsed.data.raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { success: false, error: t("noLinesFound") };

  const sep =
    parsed.data.separator === "TAB"
      ? "\t"
      : parsed.data.separator === "COMMA"
        ? ","
        : parsed.data.separator === "SEMICOLON"
          ? ";"
          : detectSeparator(lines[0]);

  type ParsedRow = {
    name: string;
    phone: string | null;
    email: string | null;
    side: "NOIVO" | "NOIVA" | "AMBOS" | null;
    groupName: string | null;
  };

  const rows: ParsedRow[] = [];
  let skipped = 0;
  for (const line of lines) {
    const parts = line.split(sep).map((p) => p.trim());
    const [name, phone, email, side, groupName] = parts;
    if (!name) {
      skipped++;
      continue;
    }
    rows.push({
      name,
      phone: phone || null,
      email: email || null,
      side: side === "NOIVO" || side === "NOIVA" || side === "AMBOS" ? side : null,
      groupName: groupName ? groupName.slice(0, 80) : null,
    });
  }

  const uniqueGroupNames = Array.from(
    new Set(rows.map((r) => r.groupName).filter((n): n is string => !!n)),
  );

  try {
    const existing =
      uniqueGroupNames.length === 0
        ? []
        : await prisma.guestGroup.findMany({
            where: { name: { in: uniqueGroupNames }, deletedAt: null },
            select: { id: true, name: true },
          });
    const groupIdByName = new Map<string, string>(existing.map((g) => [g.name, g.id]));

    const { createdCount, groupsCreated } = await prisma.$transaction(async (tx) => {
      let groupsCreatedInner = 0;
      for (const groupName of uniqueGroupNames) {
        if (!groupIdByName.has(groupName)) {
          const newGroup = await tx.guestGroup.create({ data: { name: groupName } });
          groupIdByName.set(groupName, newGroup.id);
          groupsCreatedInner++;
        }
      }
      let createdInner = 0;
      for (const row of rows) {
        const groupId = row.groupName ? (groupIdByName.get(row.groupName) ?? null) : null;
        await tx.guest.create({
          data: {
            name: row.name,
            phone: row.phone,
            email: row.email,
            side: row.side,
            groupName: row.groupName,
            groupId,
          },
        });
        createdInner++;
      }
      return { createdCount: createdInner, groupsCreated: groupsCreatedInner };
    });

    if (createdCount > 0 || groupsCreated > 0) {
      await audit("Guest", "bulk-import", "BULK_CREATE", {
        created: createdCount,
        skipped,
        groupsCreated,
      });
    }
    revalidatePath("/dashboard/guests");
    if (groupsCreated > 0) revalidatePath("/dashboard/guests/groups");
    return { success: true, data: { created: createdCount, skipped, groupsCreated } };
  } catch (err) {
    console.error("[bulkImportGuests]", err);
    return { success: false, error: t("errorImporting") };
  }
}

const RsvpPublicSchema = z.object({
  token: z.string().trim().min(1).max(64),
  status: z.enum(["CONFIRMED", "DECLINED", "MAYBE"]),
  plusOnesConfirmed: z.coerce.number().int().min(0).max(10).default(0),
  dietary: optStr(200),
  notes: optStr(500),
});

export async function publicRsvpRespond(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ name: string; status: string }>> {
  const t = await getTranslations("actions.guest");
  const ip = getClientIp(await headers());
  const rl = rateLimit(`rsvp:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return { success: false, error: t("tooManyAttempts") };
  }
  const data = Object.fromEntries(formData.entries());
  const parsed = RsvpPublicSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }
  try {
    const guest = await prisma.guest.findFirst({
      where: { rsvpToken: parsed.data.token, deletedAt: null },
    });
    if (!guest) return { success: false, error: t("inviteNotFound") };
    if (guest.rsvpTokenExpiresAt && guest.rsvpTokenExpiresAt.getTime() < Date.now()) {
      return { success: false, error: t("linkExpired") };
    }

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

    void notifyRsvpResponse({
      refType: "Guest",
      refId: updated.id,
      guestName: updated.name,
      rsvpStatus: updated.rsvpStatus,
      plusOnes: updated.plusOnesConfirmed,
    });

    return { success: true, data: { name: updated.name, status: updated.rsvpStatus } };
  } catch (err) {
    console.error("[publicRsvpRespond]", err);
    return { success: false, error: t("errorRsvp") };
  }
}

// =====================================================
// Importação por arquivo (XLSX, Wedy etc.) — 2 passos
// =====================================================

export type RowClassification = "new" | "duplicate_same" | "duplicate_diff";

export type ClassifiedRow = ParsedRow & {
  classification: RowClassification;
  existingId: string | null;
};

export type PreviewData = {
  source: ImporterId;
  sourceLabel: string;
  totalRows: number;
  breakdown: {
    new: number;
    duplicateSame: number;
    duplicateDiff: number;
  };
  sample: ClassifiedRow[];
  tagsPreview: string[];
  groupsPreview: Array<{ name: string; count: number; pin: string | null }>;
  importToken: string;
};

export type CommitMode = "CREATE_NEW_ONLY" | "UPSERT_BY_NAME" | "CREATE_ALL_DUPLICATES";

export type CommitData = {
  created: number;
  updated: number;
  skipped: number;
  groupsCreated: number;
  tagsCreated: number;
};

const MAX_PREVIEW_SAMPLE = 30;
const MAX_IMPORT_ROWS = 2000;

const PADRINHO_RE = /^(padrinho|padrinhos|madrinha|madrinhas|padrinho\/madrinha)$/i;

function phoneEq(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = (a ?? "").replace(/\D+/g, "");
  const nb = (b ?? "").replace(/\D+/g, "");
  if (!na && !nb) return true;
  return na === nb;
}

function emailEq(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = (a ?? "").trim().toLowerCase();
  const nb = (b ?? "").trim().toLowerCase();
  return na === nb;
}

function isPadrinhoTag(tags: string[]): boolean {
  return tags.some((t) => PADRINHO_RE.test(t.trim()));
}

const SourceParamSchema = z.enum(["AUTO", ...(Object.keys(IMPORTERS) as ImporterId[])]);

export async function previewGuestImport(
  _state: ActionResult<PreviewData> | undefined,
  formData: FormData,
): Promise<ActionResult<PreviewData>> {
  const t = await getTranslations("actions.guest");
  const tc = await getTranslations("actions.common");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { success: false, error: tc("unauthorized") };

  const ip = getClientIp(await headers());
  if (!rateLimit(`guest-import:${userId}`, 5, 60_000).ok) {
    return { success: false, error: t("tooManyUploads") };
  }
  if (!rateLimit(`guest-import:ip:${ip}`, 15, 60_000).ok) {
    return { success: false, error: t("uploadLimitExceeded") };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: t("fileRequired") };
  }

  const sourceParam = SourceParamSchema.safeParse(formData.get("source") ?? "AUTO");
  if (!sourceParam.success) {
    return { success: false, error: t("unknownSource") };
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    assertGuestImportSize(bytes.length);

    const filename = (file.name ?? "").toLowerCase();
    const isCsvByName = filename.endsWith(".csv");
    const isCsvByMime =
      file.type === "text/csv" || file.type === "application/csv";
    const detectedMagic = detectMagic(bytes);
    const treatAsCsv = (isCsvByName || isCsvByMime) && detectedMagic !== "xlsx";

    let sheet: ExtractedSheet;
    if (treatAsCsv) {
      sheet = extractCsvRecords(bytes.toString("utf8"));
    } else if (detectedMagic === "xlsx") {
      sheet = await extractXlsxRecords(bytes);
    } else {
      throw new FileValidationError(t("unsupportedFormat"));
    }

    let importer: Importer | null = null;
    if (sourceParam.data === "AUTO") {
      importer = detectImporter(sheet.records, sheet.headers);
      if (!importer) {
        return {
          success: false,
          error: t("unrecognizedFormat"),
        };
      }
    } else {
      importer = IMPORTERS[sourceParam.data];
    }

    const rows = importer.parseRecords(sheet.records);
    if (rows.length === 0) {
      return { success: false, error: t("noValidRows") };
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return {
        success: false,
        error: t("rowLimit", { max: MAX_IMPORT_ROWS }),
      };
    }

    const uniqueNames = Array.from(new Set(rows.map((r) => r.name)));
    const existing = await prisma.guest.findMany({
      where: { deletedAt: null, name: { in: uniqueNames } },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        groupName: true,
      },
    });
    const byName = new Map<string, typeof existing>();
    for (const e of existing) {
      const arr = byName.get(e.name) ?? [];
      arr.push(e);
      byName.set(e.name, arr);
    }

    let countNew = 0;
    let countDupSame = 0;
    let countDupDiff = 0;
    const classified: ClassifiedRow[] = rows.map((r) => {
      const matches = byName.get(r.name) ?? [];
      if (matches.length === 0) {
        countNew++;
        return { ...r, classification: "new", existingId: null };
      }
      const sameGroup = matches.find(
        (m) => (m.groupName ?? "") === (r.groupName ?? ""),
      );
      if (
        sameGroup &&
        phoneEq(sameGroup.phone, r.phone) &&
        emailEq(sameGroup.email, r.email)
      ) {
        countDupSame++;
        return { ...r, classification: "duplicate_same", existingId: sameGroup.id };
      }
      countDupDiff++;
      return {
        ...r,
        classification: "duplicate_diff",
        existingId: (sameGroup ?? matches[0]).id,
      };
    });

    const tagsSet = new Set<string>();
    for (const r of rows) for (const t of r.tags) tagsSet.add(t);

    const groupCounts = new Map<string, { count: number; pin: string | null }>();
    for (const r of rows) {
      if (!r.groupName) continue;
      const cur = groupCounts.get(r.groupName) ?? { count: 0, pin: null };
      cur.count++;
      if (!cur.pin && r.pin) cur.pin = r.pin;
      groupCounts.set(r.groupName, cur);
    }
    const groupsPreview = Array.from(groupCounts.entries()).map(([name, v]) => ({
      name,
      count: v.count,
      pin: v.pin,
    }));

    const importToken = putImport(userId, importer.id, rows);

    return {
      success: true,
      data: {
        source: importer.id,
        sourceLabel: importer.label,
        totalRows: rows.length,
        breakdown: {
          new: countNew,
          duplicateSame: countDupSame,
          duplicateDiff: countDupDiff,
        },
        sample: classified.slice(0, MAX_PREVIEW_SAMPLE),
        tagsPreview: Array.from(tagsSet).sort(),
        groupsPreview,
        importToken,
      },
    };
  } catch (err) {
    if (err instanceof FileValidationError) {
      return { success: false, error: err.message };
    }
    console.error("[previewGuestImport]", err);
    return { success: false, error: t("errorProcessingFile") };
  }
}

const CommitSchema = z.object({
  importToken: z.string().min(8).max(40),
  mode: z.enum(["CREATE_NEW_ONLY", "UPSERT_BY_NAME", "CREATE_ALL_DUPLICATES"]),
});

export async function commitGuestImport(input: {
  importToken: string;
  mode: CommitMode;
}): Promise<ActionResult<CommitData>> {
  const t = await getTranslations("actions.guest");
  const tc = await getTranslations("actions.common");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { success: false, error: tc("unauthorized") };

  const parsed = CommitSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }

  const entry = consumeImport(userId, parsed.data.importToken);
  if (!entry) {
    return {
      success: false,
      error: t("importSessionExpired"),
    };
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1) Tags
        const tagNames = Array.from(
          new Set(
            entry.rows.flatMap((r) => r.tags).map((t) => t.trim()).filter(Boolean),
          ),
        );
        const tagIdByLowerName = new Map<string, string>();
        if (tagNames.length > 0) {
          const existingTags = await tx.guestTag.findMany({
            where: { deletedAt: null, name: { in: tagNames } },
            select: { id: true, name: true },
          });
          for (const t of existingTags) {
            tagIdByLowerName.set(t.name.toLowerCase(), t.id);
          }
        }
        let tagsCreated = 0;
        for (const name of tagNames) {
          if (!tagIdByLowerName.has(name.toLowerCase())) {
            const created = await tx.guestTag.create({ data: { name } });
            tagIdByLowerName.set(created.name.toLowerCase(), created.id);
            tagsCreated++;
          }
        }

        // 2) Grupos
        const importer = IMPORTERS[entry.source];
        const contactsToGroup = importer?.contactsBelongToGroup === true;

        const groupNames = Array.from(
          new Set(entry.rows.map((r) => r.groupName).filter((n): n is string => !!n)),
        );
        const pinByGroupName = new Map<string, string>();
        type GroupContact = {
          phone?: string;
          email?: string;
          contactName?: string;
        };
        const contactByGroupName = new Map<string, GroupContact>();
        for (const r of entry.rows) {
          if (!r.groupName) continue;
          if (r.pin && !pinByGroupName.has(r.groupName)) {
            pinByGroupName.set(r.groupName, r.pin);
          }
          if (contactsToGroup) {
            const cur = contactByGroupName.get(r.groupName) ?? {};
            if (!cur.phone && r.phone) {
              cur.phone = r.phone;
              cur.contactName ??= r.name;
            }
            if (!cur.email && r.email) {
              cur.email = r.email;
              cur.contactName ??= r.name;
            }
            contactByGroupName.set(r.groupName, cur);
          }
        }

        const groupByName = new Map<
          string,
          {
            id: string;
            rsvpPin: string | null;
            contactPhone: string | null;
            contactEmail: string | null;
            contactName: string | null;
          }
        >();
        if (groupNames.length > 0) {
          const existingGroups = await tx.guestGroup.findMany({
            where: { deletedAt: null, name: { in: groupNames } },
            select: {
              id: true,
              name: true,
              rsvpPin: true,
              contactPhone: true,
              contactEmail: true,
              contactName: true,
            },
          });
          for (const g of existingGroups) {
            groupByName.set(g.name, {
              id: g.id,
              rsvpPin: g.rsvpPin,
              contactPhone: g.contactPhone,
              contactEmail: g.contactEmail,
              contactName: g.contactName,
            });
          }
        }
        let groupsCreated = 0;
        for (const name of groupNames) {
          if (!groupByName.has(name)) {
            const contact = contactByGroupName.get(name);
            const created = await tx.guestGroup.create({
              data: {
                name,
                rsvpPin: pinByGroupName.get(name) ?? null,
                contactPhone: contact?.phone ?? null,
                contactEmail: contact?.email ?? null,
                contactName: contact?.contactName ?? null,
              },
            });
            groupByName.set(name, {
              id: created.id,
              rsvpPin: created.rsvpPin,
              contactPhone: created.contactPhone,
              contactEmail: created.contactEmail,
              contactName: created.contactName,
            });
            groupsCreated++;
          } else {
            const existing = groupByName.get(name)!;
            const contact = contactByGroupName.get(name);
            const patch: {
              rsvpPin?: string;
              contactPhone?: string;
              contactEmail?: string;
              contactName?: string;
            } = {};
            if (!existing.rsvpPin && pinByGroupName.has(name)) {
              patch.rsvpPin = pinByGroupName.get(name)!;
            }
            if (contactsToGroup && contact) {
              if (!existing.contactPhone && contact.phone) patch.contactPhone = contact.phone;
              if (!existing.contactEmail && contact.email) patch.contactEmail = contact.email;
              if (!existing.contactName && contact.contactName) {
                patch.contactName = contact.contactName;
              }
            }
            if (Object.keys(patch).length > 0) {
              const updated = await tx.guestGroup.update({
                where: { id: existing.id },
                data: patch,
              });
              groupByName.set(name, {
                id: updated.id,
                rsvpPin: updated.rsvpPin,
                contactPhone: updated.contactPhone,
                contactEmail: updated.contactEmail,
                contactName: updated.contactName,
              });
            }
          }
        }

        // 3) Guests
        const uniqueNames = Array.from(new Set(entry.rows.map((r) => r.name)));
        const existingGuests =
          uniqueNames.length === 0
            ? []
            : await tx.guest.findMany({
                where: { deletedAt: null, name: { in: uniqueNames } },
                select: { id: true, name: true, groupName: true },
              });
        const existingByName = new Map<string, typeof existingGuests>();
        for (const g of existingGuests) {
          const arr = existingByName.get(g.name) ?? [];
          arr.push(g);
          existingByName.set(g.name, arr);
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const row of entry.rows) {
          const matches = existingByName.get(row.name) ?? [];
          const sameGroup = matches.find(
            (m) => (m.groupName ?? "") === (row.groupName ?? ""),
          );
          const padrinhoFlag = isPadrinhoTag(row.tags);
          const groupId = row.groupName ? groupByName.get(row.groupName)?.id ?? null : null;
          const tagIds = row.tags
            .map((t) => tagIdByLowerName.get(t.toLowerCase()))
            .filter((id): id is string => !!id);

          // Quando contatos pertencem ao grupo (ex.: Wedy), o telefone/email
          // não fica no Guest; foi para GuestGroup.contactPhone/contactEmail.
          const guestPhone = contactsToGroup ? null : row.phone;
          const guestEmail = contactsToGroup ? null : row.email;

          if (sameGroup && parsed.data.mode === "CREATE_NEW_ONLY") {
            skipped++;
            continue;
          }

          if (sameGroup && parsed.data.mode === "UPSERT_BY_NAME") {
            await tx.guest.update({
              where: { id: sameGroup.id },
              data: {
                // Quando contatos pertencem ao grupo, força null no Guest mesmo
                // que o registro existente tenha valor antigo — caso contrário
                // o dado fica duplicado (Guest.phone + GuestGroup.contactPhone).
                phone: contactsToGroup ? null : (row.phone ?? undefined),
                email: contactsToGroup ? null : (row.email ?? undefined),
                rsvpStatus: row.rsvpStatus,
                isChild: row.isChild,
                age: row.age,
                isPadrinho: padrinhoFlag ? true : undefined,
                isVIP: row.isVIP === true ? true : undefined,
                side: row.side ?? undefined,
                plusOnesAllowed: row.plusOnesAllowed ?? undefined,
                tableNumber: row.tableNumber ?? undefined,
                dietary: row.dietary ?? undefined,
                city: row.city ?? undefined,
                groupId: groupId ?? undefined,
                groupName: row.groupName ?? undefined,
              },
            });
            await tx.guestTagOnGuest.deleteMany({ where: { guestId: sameGroup.id } });
            if (tagIds.length > 0) {
              await tx.guestTagOnGuest.createMany({
                data: tagIds.map((tagId) => ({ guestId: sameGroup.id, tagId })),
              });
            }
            updated++;
            continue;
          }

          const newGuest = await tx.guest.create({
            data: {
              name: row.name,
              phone: guestPhone,
              email: guestEmail,
              side: row.side ?? null,
              groupName: row.groupName,
              groupId,
              rsvpStatus: row.rsvpStatus,
              isChild: row.isChild,
              age: row.age,
              isPadrinho: padrinhoFlag,
              isVIP: row.isVIP === true ? true : false,
              plusOnesAllowed: row.plusOnesAllowed ?? 0,
              tableNumber: row.tableNumber ?? null,
              dietary: row.dietary ?? null,
              city: row.city ?? null,
            },
          });
          if (tagIds.length > 0) {
            await tx.guestTagOnGuest.createMany({
              data: tagIds.map((tagId) => ({ guestId: newGuest.id, tagId })),
            });
          }
          created++;
        }

        return { created, updated, skipped, groupsCreated, tagsCreated };
      },
      { timeout: 30_000 },
    );

    if (result.created > 0 || result.updated > 0 || result.groupsCreated > 0) {
      await audit(
        "Guest",
        "bulk-import-file",
        "BULK_CREATE",
        {
          source: entry.source,
          mode: parsed.data.mode,
          ...result,
        },
        userId,
      );
    }

    revalidatePath("/dashboard/guests");
    if (result.groupsCreated > 0) revalidatePath("/dashboard/guests/groups");
    return { success: true, data: result };
  } catch (err) {
    console.error("[commitGuestImport]", err);
    return { success: false, error: t("errorCommittingImport") };
  }
}

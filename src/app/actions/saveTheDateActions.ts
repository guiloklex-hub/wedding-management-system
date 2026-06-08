"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { zodErrorMessage } from "@/lib/zod-i18n";
import { denyIfNoManage } from "@/lib/finance-access";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { getEventConfig, updateEventConfig } from "@/lib/event-config";
import { coerceLocale } from "@/i18n/config";
import { saveUpload, removeUpload } from "@/lib/storage";
import { detectMagic, assertMagicMatchesMime, FileValidationError } from "@/lib/file-validation";
import {
  loadSaveTheDateContext,
  sendSaveTheDate,
} from "@/lib/notifications/save-the-date";
import { armBroadcastWorker } from "@/lib/notifications/broadcast-worker";
import { buildSaveTheDateRecipients, type BuiltRecipient } from "@/lib/notifications/recipients";
import { normalizeMsisdn } from "@/lib/notifications/std-message";
import type { ActionResult } from "@/types";

const ART_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const ART_MAX_BYTES = 10 * 1024 * 1024;

const optUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

const ConfigSchema = z.object({
  weddingWebsiteUrl: optUrl,
  giftRegistryUrl: optUrl,
  saveTheDateMessage: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  removeArt: z
    .preprocess((v) => v === "on" || v === true || v === "true", z.boolean())
    .optional(),
  excludeTagIds: z.array(z.string().min(1).max(64)).max(100).default([]),
  excludePadrinhos: z
    .preprocess((v) => v === "on" || v === true || v === "true", z.boolean())
    .default(false),
});

export async function saveSaveTheDateConfig(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.saveTheDate");
  const denied = await denyIfNoManage();
  if (denied) return denied;

  const parsed = ConfigSchema.safeParse({
    weddingWebsiteUrl: formData.get("weddingWebsiteUrl") ?? "",
    giftRegistryUrl: formData.get("giftRegistryUrl") ?? "",
    saveTheDateMessage: formData.get("saveTheDateMessage") ?? "",
    removeArt: formData.get("removeArt") ?? undefined,
    excludeTagIds: formData.getAll("excludeTagIds").map(String),
    excludePadrinhos: formData.get("excludePadrinhos") ?? undefined,
  });
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }

  const current = await prisma.eventSettings.findUnique({
    where: { id: "singleton" },
    select: { saveTheDateFilePath: true },
  });

  let artUpdate: {
    saveTheDateFilePath?: string | null;
    saveTheDateFileMime?: string | null;
    saveTheDateFileName?: string | null;
  } = {};

  const file = formData.get("art");
  if (file instanceof File && file.size > 0) {
    try {
      if (file.size > ART_MAX_BYTES) {
        return { success: false, error: t("fileTooLarge") };
      }
      if (!ART_MIME.has(file.type)) {
        return { success: false, error: t("fileTypeInvalid") };
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      assertMagicMatchesMime(detectMagic(bytes), file.type);
      const stored = await saveUpload(file, {
        ownerType: "SAVE_THE_DATE",
        ownerId: "singleton",
      });
      artUpdate = {
        saveTheDateFilePath: stored.storagePath,
        saveTheDateFileMime: stored.mimeType,
        saveTheDateFileName: stored.filename,
      };
    } catch (err) {
      if (err instanceof FileValidationError) {
        return { success: false, error: err.message };
      }
      console.error("[saveSaveTheDateConfig] upload", err);
      return { success: false, error: t("errorSaving") };
    }
  } else if (parsed.data.removeArt) {
    artUpdate = {
      saveTheDateFilePath: null,
      saveTheDateFileMime: null,
      saveTheDateFileName: null,
    };
  }

  try {
    await updateEventConfig({
      weddingWebsiteUrl: parsed.data.weddingWebsiteUrl,
      giftRegistryUrl: parsed.data.giftRegistryUrl,
      saveTheDateMessage: parsed.data.saveTheDateMessage,
      saveTheDateExcludeTagIds:
        parsed.data.excludeTagIds.length > 0 ? JSON.stringify(parsed.data.excludeTagIds) : null,
      saveTheDateExcludePadrinhos: parsed.data.excludePadrinhos,
      ...artUpdate,
    });

    if (
      current?.saveTheDateFilePath &&
      "saveTheDateFilePath" in artUpdate &&
      artUpdate.saveTheDateFilePath !== current.saveTheDateFilePath
    ) {
      await removeUpload(current.saveTheDateFilePath);
    }

    await audit("EventSettings", "singleton", "UPDATE", { area: "saveTheDate" });
    revalidatePath("/dashboard/save-the-date");
    return { success: true };
  } catch (err) {
    console.error("[saveSaveTheDateConfig]", err);
    return { success: false, error: t("errorSaving") };
  }
}

const TestSchema = z.object({
  channel: z.enum(["WHATSAPP", "EMAIL"]),
  to: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function sendTestSaveTheDate(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.saveTheDate");
  const denied = await denyIfNoManage();
  if (denied) return denied;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: t("unauthorized") };

  const ip = getClientIp(await headers());
  if (!rateLimit(`std-test:${userId}`, 5, 60_000).ok || !rateLimit(`std-test:ip:${ip}`, 10, 60_000).ok) {
    return { success: false, error: t("tooManyAttempts") };
  }

  const parsed = TestSchema.safeParse({
    channel: formData.get("channel"),
    to: formData.get("to") ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, locale: true },
  });
  if (!user) return { success: false, error: t("unauthorized") };

  // Destino: o informado (se houver) ou o próprio usuário.
  let targetPhone: string | null = null;
  let targetEmail: string | null = null;
  if (parsed.data.channel === "WHATSAPP") {
    const phone = parsed.data.to ? normalizeMsisdn(parsed.data.to) : user.phone;
    if (!phone) return { success: false, error: t("noUserPhone") };
    if (!/^\+\d{10,15}$/.test(phone)) return { success: false, error: t("invalidPhone") };
    targetPhone = phone;
  } else {
    const email = parsed.data.to ?? user.email;
    if (!email) return { success: false, error: t("noUserEmail") };
    if (!z.string().email().safeParse(email).success) {
      return { success: false, error: t("invalidEmail") };
    }
    targetEmail = email;
  }

  const loaded = await loadSaveTheDateContext();
  if (!loaded.ok) {
    return { success: false, error: t("eventNotConfigured") };
  }

  const result = await sendSaveTheDate({
    ctx: loaded.ctx,
    target: {
      userId,
      phone: targetPhone,
      email: targetEmail,
      locale: user.locale ? coerceLocale(user.locale) : loaded.ctx.defaultLocale,
    },
    recipientNames: user.name ?? loaded.ctx.coupleNames,
    refType: "SaveTheDateTest",
    refId: userId,
  });

  const ok = parsed.data.channel === "WHATSAPP" ? result.whatsapp.ok : result.email.ok;
  if (!ok) {
    const error =
      (parsed.data.channel === "WHATSAPP" ? result.whatsapp.error : result.email.error) ??
      t("errorSending");
    return { success: false, error };
  }
  return { success: true };
}

async function loadAlreadySentKeys(): Promise<Set<string>> {
  const sent = await prisma.broadcastRecipient.findMany({
    where: { status: "SENT", broadcast: { kind: "SAVE_THE_DATE" } },
    select: { refType: true, refId: true },
  });
  return new Set(sent.map((r) => `${r.refType}:${r.refId}`));
}

async function loadRecipients(
  opts: { skipAlreadySent?: boolean } = {},
): Promise<BuiltRecipient[]> {
  const cfg = await getEventConfig();
  let excludeTagIds: string[] = [];
  if (cfg.saveTheDateExcludeTagIds) {
    try {
      const parsed = JSON.parse(cfg.saveTheDateExcludeTagIds);
      if (Array.isArray(parsed)) excludeTagIds = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      excludeTagIds = [];
    }
  }

  const [groups, guests, alreadySentKeys] = await Promise.all([
    prisma.guestGroup.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        contactPhone: true,
        contactEmail: true,
        guests: {
          where: { deletedAt: null },
          select: {
            name: true,
            phone: true,
            email: true,
            isPadrinho: true,
            tags: { select: { tagId: true } },
          },
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.guest.findMany({
      where: { deletedAt: null, groupId: null },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        language: true,
        isPadrinho: true,
        tags: { select: { tagId: true } },
      },
      orderBy: { name: "asc" },
    }),
    opts.skipAlreadySent ? loadAlreadySentKeys() : Promise.resolve(new Set<string>()),
  ]);

  return buildSaveTheDateRecipients(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      contactPhone: g.contactPhone,
      contactEmail: g.contactEmail,
      memberNames: g.guests.map((m) => m.name),
      memberContacts: g.guests.map((m) => ({ phone: m.phone, email: m.email })),
      memberTagIds: g.guests.flatMap((m) => m.tags.map((t) => t.tagId)),
      hasPadrinho: g.guests.some((m) => m.isPadrinho),
    })),
    guests.map((g) => ({
      id: g.id,
      name: g.name,
      phone: g.phone,
      email: g.email,
      language: g.language,
      tagIds: g.tags.map((t) => t.tagId),
      isPadrinho: g.isPadrinho,
    })),
    {
      excludeTagIds,
      excludePadrinhos: cfg.saveTheDateExcludePadrinhos,
      alreadySentKeys,
    },
  );
}

export type RecipientPreviewRow = {
  refType: string;
  refId: string;
  name: string;
  memberNames: string;
  channel: "WHATSAPP" | "EMAIL" | "NONE";
  status: "PENDING" | "SKIPPED";
  skipReason: string | null;
};

function toPreviewRow(r: BuiltRecipient): RecipientPreviewRow {
  const channel = r.phone ? "WHATSAPP" : r.email ? "EMAIL" : "NONE";
  return {
    refType: r.refType,
    refId: r.refId,
    name: r.name,
    memberNames: r.memberNames,
    channel,
    status: r.status,
    skipReason: r.skipReason,
  };
}

export async function getSaveTheDateRecipients(
  skipAlreadySent = true,
): Promise<RecipientPreviewRow[] | null> {
  const denied = await denyIfNoManage();
  if (denied) return null;
  const recipients = await loadRecipients({ skipAlreadySent });
  return recipients.map(toPreviewRow);
}

export type BroadcastProgress = {
  id: string;
  status: string;
  total: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
};

async function progressFor(broadcastId: string): Promise<BroadcastProgress | null> {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) return null;
  const grouped = await prisma.broadcastRecipient.groupBy({
    by: ["status"],
    where: { broadcastId },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const row of grouped) counts[row.status] = row._count._all;
  return {
    id: broadcast.id,
    status: broadcast.status,
    total: broadcast.total,
    pending: counts.PENDING ?? 0,
    sent: counts.SENT ?? 0,
    failed: counts.FAILED ?? 0,
    skipped: counts.SKIPPED ?? 0,
  };
}

export async function startSaveTheDateBroadcast(
  skipAlreadySent = true,
): Promise<ActionResult<BroadcastProgress>> {
  const t = await getTranslations("actions.saveTheDate");
  const denied = await denyIfNoManage();
  if (denied) return denied;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: t("unauthorized") };

  if (!rateLimit(`std-broadcast:${userId}`, 3, 60_000).ok) {
    return { success: false, error: t("tooManyAttempts") };
  }

  const active = await prisma.broadcast.findFirst({
    where: { kind: "SAVE_THE_DATE", status: { in: ["SENDING", "PAUSED"] } },
  });
  if (active) return { success: false, error: t("alreadySending") };

  const loaded = await loadSaveTheDateContext();
  if (!loaded.ok) return { success: false, error: t("eventNotConfigured") };

  const recipients = await loadRecipients({ skipAlreadySent });
  // Excluídos por tag e já-enviados são intencionais: não viram linha no envio.
  const toQueue = recipients.filter(
    (r) => r.skipReason !== "EXCLUDED_TAG" && r.skipReason !== "ALREADY_SENT",
  );
  if (toQueue.length === 0) return { success: false, error: t("noRecipients") };
  const pendingCount = toQueue.filter((r) => r.status === "PENDING").length;
  if (pendingCount === 0) return { success: false, error: t("noEligibleRecipients") };

  const broadcast = await prisma.$transaction(async (tx) => {
    const created = await tx.broadcast.create({
      data: {
        kind: "SAVE_THE_DATE",
        status: "SENDING",
        channel: "AUTO",
        total: pendingCount,
        startedAt: new Date(),
      },
    });
    await tx.broadcastRecipient.createMany({
      data: toQueue.map((r) => ({
        broadcastId: created.id,
        refType: r.refType,
        refId: r.refId,
        name: r.name,
        memberNames: r.memberNames,
        phone: r.phone,
        email: r.email,
        locale: r.locale,
        status: r.status,
        error: r.skipReason,
      })),
    });
    return created;
  });

  armBroadcastWorker();
  await audit("Broadcast", broadcast.id, "CREATE", { kind: "SAVE_THE_DATE", total: pendingCount });
  revalidatePath("/dashboard/save-the-date");

  const progress = await progressFor(broadcast.id);
  return { success: true, data: progress ?? undefined };
}

export async function getActiveSaveTheDateBroadcast(): Promise<BroadcastProgress | null> {
  const denied = await denyIfNoManage();
  if (denied) return null;
  const latest = await prisma.broadcast.findFirst({
    where: { kind: "SAVE_THE_DATE" },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return null;
  return progressFor(latest.id);
}

export async function getSaveTheDateBroadcastProgress(
  broadcastId: string,
): Promise<BroadcastProgress | null> {
  const denied = await denyIfNoManage();
  if (denied) return null;
  return progressFor(broadcastId);
}

export type BroadcastRecipientRow = {
  name: string;
  memberNames: string;
  channelUsed: string | null;
  status: string;
  error: string | null;
  sentAt: string | null;
};

export async function getSaveTheDateBroadcastRecipients(
  broadcastId: string,
): Promise<BroadcastRecipientRow[] | null> {
  const denied = await denyIfNoManage();
  if (denied) return null;
  const rows = await prisma.broadcastRecipient.findMany({
    where: { broadcastId },
    select: {
      name: true,
      memberNames: true,
      channelUsed: true,
      status: true,
      error: true,
      sentAt: true,
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    name: r.name,
    memberNames: r.memberNames,
    channelUsed: r.channelUsed,
    status: r.status,
    error: r.error,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
  }));
}

export async function resendFailedSaveTheDate(
  broadcastId: string,
): Promise<ActionResult<BroadcastProgress>> {
  const t = await getTranslations("actions.saveTheDate");
  const denied = await denyIfNoManage();
  if (denied) return denied;

  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) return { success: false, error: t("broadcastNotFound") };

  const reset = await prisma.broadcastRecipient.updateMany({
    where: { broadcastId, status: "FAILED" },
    data: { status: "PENDING", error: null, channelUsed: null, sentAt: null },
  });
  if (reset.count === 0) return { success: false, error: t("noFailedRecipients") };

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "SENDING", finishedAt: null },
  });
  armBroadcastWorker();
  await audit("Broadcast", broadcastId, "UPDATE", { resendFailed: reset.count });
  revalidatePath("/dashboard/save-the-date");

  const progress = await progressFor(broadcastId);
  return { success: true, data: progress ?? undefined };
}

export async function cancelSaveTheDateBroadcast(broadcastId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.saveTheDate");
  const denied = await denyIfNoManage();
  if (denied) return denied;

  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) return { success: false, error: t("broadcastNotFound") };

  await prisma.$transaction([
    prisma.broadcastRecipient.updateMany({
      where: { broadcastId, status: "PENDING" },
      data: { status: "SKIPPED", error: "CANCELLED" },
    }),
    prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "CANCELLED", finishedAt: new Date() },
    }),
  ]);
  await audit("Broadcast", broadcastId, "UPDATE", { cancelled: true });
  revalidatePath("/dashboard/save-the-date");
  return { success: true };
}

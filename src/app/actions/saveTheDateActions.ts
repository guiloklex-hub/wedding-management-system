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
import { updateEventConfig } from "@/lib/event-config";
import { coerceLocale } from "@/i18n/config";
import { saveUpload, removeUpload } from "@/lib/storage";
import { detectMagic, assertMagicMatchesMime, FileValidationError } from "@/lib/file-validation";
import {
  loadSaveTheDateContext,
  sendSaveTheDate,
} from "@/lib/notifications/save-the-date";
import { armBroadcastWorker } from "@/lib/notifications/broadcast-worker";
import { buildSaveTheDateRecipients } from "@/lib/notifications/recipients";
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

  const parsed = TestSchema.safeParse({ channel: formData.get("channel") });
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, locale: true },
  });
  if (!user) return { success: false, error: t("unauthorized") };

  if (parsed.data.channel === "WHATSAPP" && !user.phone) {
    return { success: false, error: t("noUserPhone") };
  }
  if (parsed.data.channel === "EMAIL" && !user.email) {
    return { success: false, error: t("noUserEmail") };
  }

  const loaded = await loadSaveTheDateContext();
  if (!loaded.ok) {
    return { success: false, error: t("eventNotConfigured") };
  }

  const result = await sendSaveTheDate({
    ctx: loaded.ctx,
    target: {
      userId,
      phone: parsed.data.channel === "WHATSAPP" ? user.phone : null,
      email: parsed.data.channel === "EMAIL" ? user.email : null,
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

async function loadRecipients() {
  const [groups, guests] = await Promise.all([
    prisma.guestGroup.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        contactPhone: true,
        contactEmail: true,
        guests: {
          where: { deletedAt: null },
          select: { name: true },
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.guest.findMany({
      where: { deletedAt: null, groupId: null },
      select: { id: true, name: true, phone: true, email: true, language: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return buildSaveTheDateRecipients(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      contactPhone: g.contactPhone,
      contactEmail: g.contactEmail,
      memberNames: g.guests.map((m) => m.name),
    })),
    guests.map((g) => ({
      id: g.id,
      name: g.name,
      phone: g.phone,
      email: g.email,
      language: g.language,
    })),
  );
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

export async function startSaveTheDateBroadcast(): Promise<ActionResult<BroadcastProgress>> {
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

  const recipients = await loadRecipients();
  if (recipients.length === 0) return { success: false, error: t("noRecipients") };
  const pendingCount = recipients.filter((r) => r.status === "PENDING").length;
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
      data: recipients.map((r) => ({
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

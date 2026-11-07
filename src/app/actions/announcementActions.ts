"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { zodErrorMessage } from "@/lib/zod-i18n";
import { denyIfNoEdit, denyIfNoManage } from "@/lib/finance-access";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { coerceLocale } from "@/i18n/config";
import { readUpload, removeUpload, saveUpload } from "@/lib/storage";
import { FileValidationError } from "@/lib/file-validation";
import { validateArtFile } from "@/lib/art-upload";
import { isEmailConfigured } from "@/lib/notifications/email";
import { getWhatsAppStatus } from "@/lib/notifications/whatsapp";
import { normalizeMsisdn } from "@/lib/notifications/std-message";
import { resolveRsvpLink } from "@/lib/notifications/official-invitation";
import { armBroadcastWorker } from "@/lib/notifications/broadcast-worker";
import { announcementUsesTag } from "@/lib/notifications/announcement-message";
import { buildAnnouncementRecipients } from "@/lib/notifications/announcement-recipients";
import {
  ANNOUNCEMENT_KIND,
  AnnouncementDraftInputSchema,
  AnnouncementIdSchema,
  AnnouncementPayloadSchema,
  newAnnouncementConfig,
  parseAnnouncementPayload,
  refKey,
  type AnnouncementArt,
  type AnnouncementPayload,
  type AnnouncementRecipientPayload,
} from "@/lib/notifications/announcement-config";
import {
  buildAnnouncementContext,
  loadAnnouncementSources,
  loadRsvpSecrets,
  readAnnouncementMedia,
  sendAnnouncement,
} from "@/lib/notifications/announcement";
import type { ActionResult } from "@/types";

const LIST_PATH = "/dashboard/communications/announcements";
const PAYLOAD_MAX_CHARS = 200_000;

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function revalidateAnnouncement(id?: string) {
  revalidatePath("/dashboard/communications");
  revalidatePath(LIST_PATH);
  if (id) revalidatePath(`${LIST_PATH}/${id}`);
}

function whatsappUsable(): boolean {
  const state = getWhatsAppStatus().state;
  return state === "CONNECTED" || state === "DISCONNECTED";
}

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

type Loaded = {
  id: string;
  status: string;
  startedAt: Date | null;
  payload: AnnouncementPayload;
};

async function loadAnnouncement(
  rawId: unknown,
  t: Translator,
): Promise<{ ok: true; value: Loaded } | { ok: false; error: string }> {
  const id = AnnouncementIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: t("invalidId") };
  const row = await prisma.broadcast.findFirst({
    where: { id: id.data, kind: ANNOUNCEMENT_KIND },
    select: { id: true, status: true, startedAt: true, payloadJson: true },
  });
  if (!row) return { ok: false, error: t("notFound") };
  const payload = parseAnnouncementPayload(row.payloadJson);
  if (!payload) return { ok: false, error: t("invalidPayload") };
  return { ok: true, value: { id: row.id, status: row.status, startedAt: row.startedAt, payload } };
}

export async function createAnnouncementDraft(): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("actions.announcements");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const userId = await currentUserId();
  if (!userId) return { success: false, error: t("unauthorized") };
  if (!rateLimit(`announcement-create:${userId}`, 10, 60_000).ok) {
    return { success: false, error: t("tooManyAttempts") };
  }

  const payload: AnnouncementPayload = {
    version: 1,
    kind: ANNOUNCEMENT_KIND,
    config: newAnnouncementConfig(t("defaultTitle")),
    context: null,
  };
  const created = await prisma.broadcast.create({
    data: {
      kind: ANNOUNCEMENT_KIND,
      status: "DRAFT",
      channel: payload.config.channel,
      total: 0,
      payloadJson: JSON.stringify(payload),
    },
    select: { id: true },
  });
  await audit("Broadcast", created.id, "CREATE", { kind: ANNOUNCEMENT_KIND });
  revalidateAnnouncement();
  return { success: true, data: { id: created.id } };
}

export async function saveAnnouncementDraft(
  _state: ActionResult<{ art: AnnouncementArt | null }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ art: AnnouncementArt | null }>> {
  const t = await getTranslations("actions.announcements");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const userId = await currentUserId();
  if (!userId) return { success: false, error: t("unauthorized") };
  if (!rateLimit(`announcement-save:${userId}`, 20, 60_000).ok) {
    return { success: false, error: t("tooManyAttempts") };
  }

  const rawPayload = formData.get("payload");
  if (typeof rawPayload !== "string" || rawPayload.length > PAYLOAD_MAX_CHARS) {
    return { success: false, error: t("invalidPayload") };
  }
  let json: unknown;
  try {
    json = JSON.parse(rawPayload);
  } catch {
    return { success: false, error: t("invalidPayload") };
  }
  const input = AnnouncementDraftInputSchema.safeParse(json);
  if (!input.success) {
    return { success: false, error: zodErrorMessage(input.error, await getTranslations("common")) };
  }

  const loaded = await loadAnnouncement(formData.get("id"), t);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { id, status, payload: current } = loaded.value;
  if (status !== "DRAFT") return { success: false, error: t("notDraft") };

  const oldArt = current.config.art;
  let art: AnnouncementArt | null = oldArt;
  let newlyStoredPath: string | null = null;
  const file = formData.get("art");
  if (file instanceof File && file.size > 0) {
    try {
      const invalid = await validateArtFile(file);
      if (invalid) return { success: false, error: t(invalid) };
      const stored = await saveUpload(file, { ownerType: ANNOUNCEMENT_KIND, ownerId: id });
      newlyStoredPath = stored.storagePath;
      art = { path: stored.storagePath, mime: stored.mimeType as AnnouncementArt["mime"], name: stored.filename };
    } catch (err) {
      if (err instanceof FileValidationError) return { success: false, error: err.message };
      console.error("[announcement] upload", err);
      return { success: false, error: t("errorSaving") };
    }
  } else if (formData.get("removeArt") === "true") {
    art = null;
  }

  const next = AnnouncementPayloadSchema.safeParse({
    version: 1,
    kind: ANNOUNCEMENT_KIND,
    config: { ...input.data, art },
    context: null,
  });
  const discardNewUpload = async () => {
    if (newlyStoredPath && newlyStoredPath !== oldArt?.path) await removeUpload(newlyStoredPath);
  };
  if (!next.success) {
    await discardNewUpload();
    return { success: false, error: t("invalidPayload") };
  }

  const updated = await prisma.broadcast.updateMany({
    where: { id, kind: ANNOUNCEMENT_KIND, status: "DRAFT" },
    data: { payloadJson: JSON.stringify(next.data), channel: next.data.config.channel },
  });
  if (updated.count === 0) {
    await discardNewUpload();
    return { success: false, error: t("notDraft") };
  }
  if (oldArt && oldArt.path !== art?.path) await removeUpload(oldArt.path);

  await audit("Broadcast", id, "UPDATE", { kind: ANNOUNCEMENT_KIND, hasArt: Boolean(art) });
  revalidateAnnouncement(id);
  return { success: true, data: { art } };
}

export async function deleteAnnouncementDraft(rawId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.announcements");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const loaded = await loadAnnouncement(rawId, t);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { id, payload } = loaded.value;

  const deleted = await prisma.broadcast.deleteMany({
    where: { id, kind: ANNOUNCEMENT_KIND, status: "DRAFT" },
  });
  if (deleted.count === 0) return { success: false, error: t("notDraft") };
  if (payload.config.art) await removeUpload(payload.config.art.path);

  await audit("Broadcast", id, "DELETE", { kind: ANNOUNCEMENT_KIND });
  revalidateAnnouncement();
  return { success: true };
}

export async function duplicateAnnouncement(rawId: string): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("actions.announcements");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const userId = await currentUserId();
  if (!userId) return { success: false, error: t("unauthorized") };
  if (!rateLimit(`announcement-create:${userId}`, 10, 60_000).ok) {
    return { success: false, error: t("tooManyAttempts") };
  }
  const loaded = await loadAnnouncement(rawId, t);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const source = loaded.value.payload.config;

  const config = {
    ...source,
    title: t("copyTitle", { title: source.title }).slice(0, 120),
    art: null as AnnouncementArt | null,
  };
  const created = await prisma.broadcast.create({
    data: {
      kind: ANNOUNCEMENT_KIND,
      status: "DRAFT",
      channel: config.channel,
      total: 0,
      payloadJson: JSON.stringify({ version: 1, kind: ANNOUNCEMENT_KIND, config, context: null }),
    },
    select: { id: true },
  });

  if (source.art) {
    try {
      const data = await readUpload(source.art.path);
      const stored = await saveUpload(new File([new Uint8Array(data)], source.art.name, { type: source.art.mime }), {
        ownerType: ANNOUNCEMENT_KIND,
        ownerId: created.id,
      });
      config.art = { path: stored.storagePath, mime: source.art.mime, name: stored.filename };
      await prisma.broadcast.update({
        where: { id: created.id },
        data: { payloadJson: JSON.stringify({ version: 1, kind: ANNOUNCEMENT_KIND, config, context: null }) },
      });
    } catch (err) {
      console.error("[announcement] falha ao copiar a arte", err);
    }
  }

  await audit("Broadcast", created.id, "CREATE", { kind: ANNOUNCEMENT_KIND, duplicatedFrom: loaded.value.id });
  revalidateAnnouncement();
  return { success: true, data: { id: created.id } };
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

export async function sendTestAnnouncement(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.announcements");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const userId = await currentUserId();
  if (!userId) return { success: false, error: t("unauthorized") };

  const ip = getClientIp(await headers());
  if (
    !rateLimit(`announcement-test:${userId}`, 3, 60_000).ok ||
    !rateLimit(`announcement-test:ip:${ip}`, 10, 60_000).ok
  ) {
    return { success: false, error: t("tooManyAttempts") };
  }

  const parsed = TestSchema.safeParse({ channel: formData.get("channel"), to: formData.get("to") ?? "" });
  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }

  const loaded = await loadAnnouncement(formData.get("id"), t);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const config = loaded.value.payload.config;
  if (!config.message.trim()) return { success: false, error: t("messageRequired") };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, locale: true },
  });
  if (!user) return { success: false, error: t("unauthorized") };

  let phone: string | null = null;
  let email: string | null = null;
  if (parsed.data.channel === "WHATSAPP") {
    phone = parsed.data.to ? normalizeMsisdn(parsed.data.to) : user.phone;
    if (!phone) return { success: false, error: t("noUserPhone") };
    if (!/^\+\d{10,15}$/.test(phone)) return { success: false, error: t("invalidPhone") };
  } else {
    email = parsed.data.to ?? user.email;
    if (!email) return { success: false, error: t("noUserEmail") };
    if (!z.string().email().safeParse(email).success) return { success: false, error: t("invalidEmail") };
  }

  const context = await buildAnnouncementContext();
  if (!context) return { success: false, error: t("eventNotConfigured") };
  let media;
  try {
    media = await readAnnouncementMedia(config);
  } catch {
    return { success: false, error: t("artFileUnreadable") };
  }

  const sampleName = user.name ?? t("testGuestName");
  const recipient: AnnouncementRecipientPayload = {
    version: 1,
    refType: "Guest",
    refId: userId.slice(0, 64),
    memberNames: sampleName,
    locale: user.locale ? coerceLocale(user.locale) : context.defaultLocale,
    phone,
    email,
    rsvpLink: resolveRsvpLink({
      rsvpMode: context.rsvpMode,
      externalUrl: context.externalRsvpUrl,
      refType: "Guest",
      rsvpToken: "demo-test-token",
      appUrl: context.appUrl,
    }),
    pin: "1234",
  };

  const res = await sendAnnouncement({
    ctx: { config, context, media },
    recipient,
    channelOverride: parsed.data.channel,
    logRef: { refType: "AnnouncementTest", refId: userId },
  });
  if (!res.ok) return { success: false, error: res.error ?? t("errorSending") };

  await audit("Broadcast", loaded.value.id, "UPDATE", {
    kind: ANNOUNCEMENT_KIND,
    testSend: true,
    channel: parsed.data.channel,
  });
  return { success: true };
}

export type AnnouncementProgress = {
  id: string;
  status: string;
  total: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  unknown: number;
  queuedBehind: number;
};

async function progressFor(id: string): Promise<AnnouncementProgress | null> {
  const broadcast = await prisma.broadcast.findFirst({
    where: { id, kind: ANNOUNCEMENT_KIND },
    select: { id: true, status: true, total: true, startedAt: true },
  });
  if (!broadcast) return null;
  const [grouped, unknown, queuedBehind] = await Promise.all([
    prisma.broadcastRecipient.groupBy({ by: ["status"], where: { broadcastId: id }, _count: { _all: true } }),
    prisma.broadcastRecipient.count({
      where: { broadcastId: id, status: "FAILED", error: "DELIVERY_STATE_UNKNOWN" },
    }),
    broadcast.status === "SENDING" && broadcast.startedAt
      ? prisma.broadcast.count({
          where: { status: "SENDING", startedAt: { lt: broadcast.startedAt }, id: { not: id } },
        })
      : Promise.resolve(0),
  ]);
  const counts: Record<string, number> = {};
  for (const row of grouped) counts[row.status] = row._count._all;
  return {
    id: broadcast.id,
    status: broadcast.status,
    total: broadcast.total,
    pending: (counts.PENDING ?? 0) + (counts.PROCESSING ?? 0),
    sent: counts.SENT ?? 0,
    failed: counts.FAILED ?? 0,
    skipped: counts.SKIPPED ?? 0,
    unknown,
    queuedBehind,
  };
}

export async function startAnnouncement(rawId: string): Promise<ActionResult<AnnouncementProgress>> {
  const t = await getTranslations("actions.announcements");
  const denied = await denyIfNoManage();
  if (denied) return denied;
  const userId = await currentUserId();
  if (!userId) return { success: false, error: t("unauthorized") };
  if (!rateLimit(`announcement-start:${userId}`, 3, 60_000).ok) {
    return { success: false, error: t("tooManyAttempts") };
  }

  const loaded = await loadAnnouncement(rawId, t);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { id, status, payload } = loaded.value;
  const config = payload.config;
  if (status !== "DRAFT") return { success: false, error: t("notDraft") };
  if (!config.message.trim()) return { success: false, error: t("messageRequired") };

  const context = await buildAnnouncementContext();
  if (!context) return { success: false, error: t("eventNotConfigured") };
  if (announcementUsesTag(config.message, "data") && !context.eventDate) {
    return { success: false, error: t("eventDateRequired", { tag: "{data}" }) };
  }

  const waOk = whatsappUsable();
  const emailOk = isEmailConfigured();
  if (config.channel === "WHATSAPP" && !waOk) return { success: false, error: t("whatsappOffline") };
  if (config.channel === "EMAIL" && !emailOk) return { success: false, error: t("emailNotConfigured") };
  if (config.channel === "AUTO" && !waOk && !emailOk) return { success: false, error: t("noChannelAvailable") };

  if (config.art) {
    try {
      await readUpload(config.art.path);
    } catch {
      return { success: false, error: t("artFileUnreadable") };
    }
  }

  const active = await prisma.broadcast.findFirst({
    where: { kind: ANNOUNCEMENT_KIND, status: { in: ["SENDING", "PAUSED"] } },
    select: { id: true },
  });
  if (active) return { success: false, error: t("alreadySending") };

  const [sources, secrets] = await Promise.all([loadAnnouncementSources(), loadRsvpSecrets()]);
  const { rows } = buildAnnouncementRecipients({
    ...sources,
    audience: config.audience,
    channel: config.channel,
    excludedRefs: config.excludedRefs,
    requirePin: announcementUsesTag(config.message, "pin"),
    defaultLocale: context.defaultLocale,
  });
  const toQueue = rows.filter((r) => r.skipReason !== "MANUAL_EXCLUDED");
  if (!toQueue.some((r) => r.status === "PENDING")) {
    return { success: false, error: t("noEligibleRecipients") };
  }

  const snapshot: AnnouncementPayload = { ...payload, context };
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.broadcast.updateMany({
        where: { id, kind: ANNOUNCEMENT_KIND, status: "DRAFT" },
        data: {
          status: "SENDING",
          channel: config.channel,
          total: toQueue.length,
          startedAt: new Date(),
          payloadJson: JSON.stringify(snapshot),
        },
      });
      if (claimed.count !== 1) throw new Error("NOT_DRAFT");

      await tx.broadcastRecipient.createMany({
        data: toQueue.map((r) => {
          const secret = secrets.get(refKey(r.refType, r.refId));
          const recipientPayload: AnnouncementRecipientPayload = {
            version: 1,
            refType: r.refType,
            refId: r.refId,
            memberNames: r.memberNames,
            locale: r.locale ?? context.defaultLocale,
            phone: r.phone,
            email: r.email,
            rsvpLink: secret
              ? resolveRsvpLink({
                  rsvpMode: context.rsvpMode,
                  externalUrl: context.externalRsvpUrl,
                  refType: r.refType,
                  rsvpToken: secret.token,
                  appUrl: context.appUrl,
                })
              : null,
            pin: secret?.pin ?? null,
          };
          return {
            broadcastId: id,
            refType: r.refType,
            refId: r.refId,
            name: r.name,
            memberNames: r.memberNames,
            phone: r.phone,
            email: r.email,
            locale: r.locale,
            status: r.status,
            error: r.skipReason,
            payloadJson: JSON.stringify(recipientPayload),
          };
        }),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_DRAFT") return { success: false, error: t("notDraft") };
    console.error("[announcement] start", err);
    return { success: false, error: t("errorSending") };
  }

  armBroadcastWorker();
  await audit("Broadcast", id, "UPDATE", {
    kind: ANNOUNCEMENT_KIND,
    action: "START",
    total: toQueue.length,
    channel: config.channel,
  });
  revalidateAnnouncement(id);
  const progress = await progressFor(id);
  return { success: true, data: progress ?? undefined };
}

export async function getAnnouncementProgress(rawId: string): Promise<AnnouncementProgress | null> {
  const denied = await denyIfNoEdit();
  if (denied) return null;
  const id = AnnouncementIdSchema.safeParse(rawId);
  if (!id.success) return null;
  return progressFor(id.data);
}

export type AnnouncementRecipientRow = {
  id: string;
  name: string;
  memberNames: string;
  channelUsed: string | null;
  status: string;
  error: string | null;
  sentAt: string | null;
};

async function recipientsOf(id: string) {
  return prisma.broadcastRecipient.findMany({
    where: { broadcastId: id, broadcast: { kind: ANNOUNCEMENT_KIND } },
    select: { id: true, name: true, memberNames: true, channelUsed: true, status: true, error: true, sentAt: true },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function getAnnouncementRecipients(rawId: string): Promise<AnnouncementRecipientRow[] | null> {
  const denied = await denyIfNoEdit();
  if (denied) return null;
  const id = AnnouncementIdSchema.safeParse(rawId);
  if (!id.success) return null;
  const rows = await recipientsOf(id.data);
  return rows.map((r) => ({ ...r, sentAt: r.sentAt ? r.sentAt.toISOString() : null }));
}

export async function resendFailedAnnouncement(
  rawId: string,
  confirmUnknown = false,
): Promise<ActionResult<AnnouncementProgress>> {
  const t = await getTranslations("actions.announcements");
  const denied = await denyIfNoManage();
  if (denied) return denied;
  const userId = await currentUserId();
  if (!userId) return { success: false, error: t("unauthorized") };
  if (!rateLimit(`announcement-start:${userId}`, 3, 60_000).ok) {
    return { success: false, error: t("tooManyAttempts") };
  }
  const loaded = await loadAnnouncement(rawId, t);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { id, status } = loaded.value;
  if (status === "DRAFT") return { success: false, error: t("notStarted") };

  const other = await prisma.broadcast.findFirst({
    where: { kind: ANNOUNCEMENT_KIND, status: { in: ["SENDING", "PAUSED"] }, id: { not: id } },
    select: { id: true },
  });
  if (other) return { success: false, error: t("alreadySending") };

  const unknownCount = await prisma.broadcastRecipient.count({
    where: { broadcastId: id, status: "FAILED", error: "DELIVERY_STATE_UNKNOWN" },
  });
  if (unknownCount > 0 && !confirmUnknown) {
    return { success: false, error: t("confirmUnknownStateRequired", { count: unknownCount }) };
  }

  const reset = await prisma.broadcastRecipient.updateMany({
    where: { broadcastId: id, status: "FAILED" },
    data: { status: "PENDING", error: null, channelUsed: null, sentAt: null, processingStartedAt: null },
  });
  if (reset.count === 0) return { success: false, error: t("noFailedRecipients") };

  await prisma.broadcast.update({ where: { id }, data: { status: "SENDING", finishedAt: null } });
  armBroadcastWorker();
  await audit("Broadcast", id, "UPDATE", { kind: ANNOUNCEMENT_KIND, action: "RESEND_FAILED", count: reset.count });
  revalidateAnnouncement(id);
  const progress = await progressFor(id);
  return { success: true, data: progress ?? undefined };
}

export async function cancelAnnouncement(rawId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.announcements");
  const denied = await denyIfNoManage();
  if (denied) return denied;
  const loaded = await loadAnnouncement(rawId, t);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { id, status } = loaded.value;
  if (status !== "SENDING" && status !== "PAUSED") return { success: false, error: t("notSending") };

  await prisma.$transaction([
    prisma.broadcastRecipient.updateMany({
      where: { broadcastId: id, status: "PENDING" },
      data: { status: "SKIPPED", error: "CANCELLED", processingStartedAt: null },
    }),
    prisma.broadcast.update({ where: { id }, data: { status: "CANCELLED", finishedAt: new Date() } }),
  ]);
  await audit("Broadcast", id, "UPDATE", { kind: ANNOUNCEMENT_KIND, action: "CANCEL" });
  revalidateAnnouncement(id);
  return { success: true };
}

function csvCell(val: string | null | undefined): string {
  if (!val) return "";
  let str = val.replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return `"${str}"`;
}

export async function exportAnnouncementCsv(rawId: string): Promise<ActionResult<string>> {
  const t = await getTranslations("actions.announcements");
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  const loaded = await loadAnnouncement(rawId, t);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const rows = await recipientsOf(loaded.value.id);

  const header = ["name", "members", "channel", "status", "reason", "sentAt"].map((k) => t(`csv.${k}`));
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [r.name, r.memberNames, r.channelUsed, r.status, r.error, r.sentAt ? r.sentAt.toISOString() : ""]
        .map(csvCell)
        .join(","),
    );
  }
  return { success: true, data: "﻿" + lines.join("\r\n") };
}

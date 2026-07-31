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
import { getEventConfig, updateEventConfig } from "@/lib/event-config";
import { coerceLocale } from "@/i18n/config";
import { saveUpload, readUpload, removeUpload } from "@/lib/storage";
import { detectMagic, assertMagicMatchesMime, FileValidationError } from "@/lib/file-validation";
import {
  buildInvitationRecipients,
  type BuiltRecipient,
} from "@/lib/notifications/recipients";
import {
  validateInvitationMessage,
  resolveRsvpLink,
  getAppUrl,
  loadInvitationContextFromPayload,
  sendInvitation,
  type BroadcastPayload,
  type RecipientPayload,
} from "@/lib/notifications/official-invitation";
import { armBroadcastWorker } from "@/lib/notifications/broadcast-worker";
import { normalizeMsisdn } from "@/lib/notifications/std-message";
import type { ActionResult } from "@/types";

const ART_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const ART_MAX_BYTES = 10 * 1024 * 1024;

const optUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

const ConfigSchema = z.object({
  invitationMessage: z.string().trim().max(4000).min(1),
  invitationRsvpUseExternal: z
    .preprocess((v) => v === "on" || v === true || v === "true", z.boolean())
    .default(false),
  invitationRsvpUrl: optUrl,
  invitationRsvpDeadline: z
    .string()
    .trim()
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

export async function saveInvitationConfig(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.invitations");
  const denied = await denyIfNoManage();
  if (denied) return denied;

  // Bloquear alteração se houver broadcast ativo de convite oficial
  const active = await prisma.broadcast.findFirst({
    where: { kind: "OFFICIAL_INVITATION", status: { in: ["SENDING", "PAUSED"] } },
  });
  if (active) {
    return { success: false, error: t("cannotEditActiveBroadcast") };
  }

  const parsed = ConfigSchema.safeParse({
    invitationMessage: formData.get("invitationMessage") ?? "",
    invitationRsvpUseExternal: formData.get("invitationRsvpUseExternal") ?? undefined,
    invitationRsvpUrl: formData.get("invitationRsvpUrl") ?? "",
    invitationRsvpDeadline: formData.get("invitationRsvpDeadline") ?? "",
    removeArt: formData.get("removeArt") ?? undefined,
    excludeTagIds: formData.getAll("excludeTagIds").map(String),
    excludePadrinhos: formData.get("excludePadrinhos") ?? undefined,
  });

  if (!parsed.success) {
    return { success: false, error: zodErrorMessage(parsed.error, await getTranslations("common")) };
  }

  // Validação de merge tags na mensagem
  const msgValidation = validateInvitationMessage(parsed.data.invitationMessage);
  if (!msgValidation.valid) {
    if (msgValidation.missingMandatory.length > 0) {
      return {
        success: false,
        error: t("missingTags", { tags: msgValidation.missingMandatory.map((t) => `{${t}}`).join(", ") }),
      };
    }
    if (msgValidation.unknownTags.length > 0) {
      return {
        success: false,
        error: t("unknownTags", { tags: msgValidation.unknownTags.map((t) => `{${t}}`).join(", ") }),
      };
    }
  }

  // Validação da URL externa
  if (parsed.data.invitationRsvpUseExternal) {
    if (!parsed.data.invitationRsvpUrl) {
      return { success: false, error: t("externalUrlRequired") };
    }
    const isProd = process.env.NODE_ENV === "production";
    try {
      const u = new URL(parsed.data.invitationRsvpUrl);
      if (isProd && u.protocol !== "https:") {
        return { success: false, error: t("externalUrlHttpsRequired") };
      }
      if (!isProd && u.protocol !== "http:" && u.protocol !== "https:") {
        return { success: false, error: t("externalUrlInvalidScheme") };
      }
    } catch {
      return { success: false, error: t("externalUrlInvalid") };
    }
  }

  // Validação da data limite
  if (parsed.data.invitationRsvpDeadline) {
    const dStr = parsed.data.invitationRsvpDeadline;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
      return { success: false, error: t("deadlineInvalidFormat") };
    }
    const [y, m, d] = dStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    if (isNaN(dateObj.getTime())) {
      return { success: false, error: t("deadlineInvalidDate") };
    }
  }

  const current = await prisma.eventSettings.findUnique({
    where: { id: "singleton" },
    select: { invitationFilePath: true },
  });

  let artUpdate: {
    invitationFilePath?: string | null;
    invitationFileMime?: string | null;
    invitationFileName?: string | null;
  } = {};

  const file = formData.get("art");
  let newlyStoredPath: string | null = null;

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
        ownerType: "OFFICIAL_INVITATION",
        ownerId: "singleton",
      });
      newlyStoredPath = stored.storagePath;
      artUpdate = {
        invitationFilePath: stored.storagePath,
        invitationFileMime: stored.mimeType,
        invitationFileName: stored.filename,
      };
    } catch (err) {
      if (err instanceof FileValidationError) {
        return { success: false, error: err.message };
      }
      console.error("[saveInvitationConfig] upload error", err);
      return { success: false, error: t("errorSaving") };
    }
  } else if (parsed.data.removeArt) {
    artUpdate = {
      invitationFilePath: null,
      invitationFileMime: null,
      invitationFileName: null,
    };
  }

  try {
    await updateEventConfig({
      invitationMessage: parsed.data.invitationMessage,
      invitationRsvpUseExternal: parsed.data.invitationRsvpUseExternal,
      invitationRsvpUrl: parsed.data.invitationRsvpUrl,
      invitationRsvpDeadline: parsed.data.invitationRsvpDeadline,
      invitationExcludeTagIds:
        parsed.data.excludeTagIds.length > 0 ? JSON.stringify(parsed.data.excludeTagIds) : null,
      invitationExcludePadrinhos: parsed.data.excludePadrinhos,
      ...artUpdate,
    });

    if (
      current?.invitationFilePath &&
      "invitationFilePath" in artUpdate &&
      artUpdate.invitationFilePath !== current.invitationFilePath
    ) {
      await removeUpload(current.invitationFilePath);
    }

    await audit("EventSettings", "singleton", "UPDATE", {
      area: "officialInvitation",
      rsvpMode: parsed.data.invitationRsvpUseExternal ? "EXTERNAL" : "NATIVE",
      hasArt: !!artUpdate.invitationFilePath,
    });
    revalidatePath("/dashboard/invitations");
    return { success: true };
  } catch (err) {
    if (newlyStoredPath) {
      await removeUpload(newlyStoredPath).catch(() => {});
    }
    console.error("[saveInvitationConfig]", err);
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

export async function sendTestInvitation(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.invitations");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: t("unauthorized") };

  const ip = getClientIp(await headers());
  if (!rateLimit(`invitation-test:${userId}`, 3, 60_000).ok || !rateLimit(`invitation-test:ip:${ip}`, 10, 60_000).ok) {
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

  const cfg = await getEventConfig();
  if (!cfg.invitationMessage || !cfg.coupleNames) {
    return { success: false, error: t("eventNotConfigured") };
  }

  const appUrl = getAppUrl();
  const testPayload: BroadcastPayload = {
    version: 1,
    kind: "OFFICIAL_INVITATION",
    message: cfg.invitationMessage,
    rsvpMode: cfg.invitationRsvpUseExternal ? "EXTERNAL" : "NATIVE",
    externalUrl: cfg.invitationRsvpUrl,
    deadline: cfg.invitationRsvpDeadline,
    coupleNames: cfg.coupleNames,
    eventDate: cfg.eventDate ? cfg.eventDate.toISOString() : null,
    daySchedule: cfg.daySchedule,
    artFilePath: cfg.invitationFilePath,
    artFileMime: cfg.invitationFileMime,
    artFileName: cfg.invitationFileName,
    appUrl,
  };

  const loadedCtx = await loadInvitationContextFromPayload(JSON.stringify(testPayload));
  if (!loadedCtx.ok) {
    return { success: false, error: t("artFileUnreadable") };
  }

  const demoLink = resolveRsvpLink({
    rsvpMode: testPayload.rsvpMode,
    externalUrl: testPayload.externalUrl,
    refType: "Guest",
    rsvpToken: "demo-test-token",
    appUrl,
  });

  const recipientPayload: RecipientPayload = {
    version: 1,
    refType: "Guest",
    refId: userId,
    name: user.name ?? "Convidado de Teste",
    memberNames: user.name ?? "Convidado de Teste",
    locale: user.locale ? coerceLocale(user.locale) : cfg.defaultLocale,
    pin: "1234",
    rsvpLink: demoLink,
    phone: targetPhone,
    email: targetEmail,
  };

  const sendRes = await sendInvitation({
    ctx: loadedCtx.ctx,
    recipientPayload,
    channelOverride: parsed.data.channel,
  });

  if (!sendRes.ok) {
    return { success: false, error: sendRes.error ?? t("errorSending") };
  }

  await audit("EventSettings", "singleton", "UPDATE", {
    testSend: true,
    channel: parsed.data.channel,
  });

  return { success: true };
}

async function loadAlreadySentKeys(): Promise<Set<string>> {
  const sent = await prisma.broadcastRecipient.findMany({
    where: { status: "SENT", broadcast: { kind: "OFFICIAL_INVITATION" } },
    select: { refType: true, refId: true },
  });
  return new Set(sent.map((r) => `${r.refType}:${r.refId}`));
}

type RecipientWithRsvpData = BuiltRecipient & {
  hasPin: boolean;
  rsvpToken: string | null;
  rsvpPin: string | null;
};

async function loadRecipients(
  opts: { skipAlreadySent?: boolean } = {},
): Promise<RecipientWithRsvpData[]> {
  const cfg = await getEventConfig();
  let excludeTagIds: string[] = [];
  if (cfg.invitationExcludeTagIds) {
    try {
      const parsed = JSON.parse(cfg.invitationExcludeTagIds);
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
        rsvpToken: true,
        rsvpPin: true,
        contactPhone: true,
        contactEmail: true,
        guests: {
          where: { deletedAt: null },
          select: {
            name: true,
            phone: true,
            email: true,
            language: true,
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
        rsvpToken: true,
        rsvpPin: true,
        isPadrinho: true,
        tags: { select: { tagId: true } },
      },
      orderBy: { name: "asc" },
    }),
    opts.skipAlreadySent ? loadAlreadySentKeys() : Promise.resolve(new Set<string>()),
  ]);

  const groupPinMap = new Map<string, string | null>();
  const groupTokenMap = new Map<string, string | null>();
  for (const g of groups) {
    groupPinMap.set(g.id, g.rsvpPin);
    groupTokenMap.set(g.id, g.rsvpToken);
  }

  const guestPinMap = new Map<string, string | null>();
  const guestTokenMap = new Map<string, string | null>();
  for (const g of guests) {
    guestPinMap.set(g.id, g.rsvpPin);
    guestTokenMap.set(g.id, g.rsvpToken);
  }

  const built = buildInvitationRecipients(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      contactPhone: g.contactPhone,
      contactEmail: g.contactEmail,
      memberNames: g.guests.map((m) => m.name),
      memberContacts: g.guests.map((m) => ({ phone: m.phone, email: m.email })),
      memberLocales: g.guests.map((m) => m.language),
      memberTagIds: g.guests.flatMap((m) => m.tags.map((t) => t.tagId)),
      hasPadrinho: g.guests.some((m) => m.isPadrinho),
      rsvpPin: g.rsvpPin,
      rsvpToken: g.rsvpToken,
    })),
    guests.map((g) => ({
      id: g.id,
      name: g.name,
      phone: g.phone,
      email: g.email,
      language: g.language,
      tagIds: g.tags.map((t) => t.tagId),
      isPadrinho: g.isPadrinho,
      rsvpPin: g.rsvpPin,
      rsvpToken: g.rsvpToken,
    })),
    {
      excludeTagIds,
      excludePadrinhos: cfg.invitationExcludePadrinhos,
      alreadySentKeys,
    },
  );

  return built.map((b) => {
    const pin = b.refType === "GuestGroup" ? groupPinMap.get(b.refId) : guestPinMap.get(b.refId);
    const token = b.refType === "GuestGroup" ? groupTokenMap.get(b.refId) : guestTokenMap.get(b.refId);
    const hasPin = Boolean(pin && pin.trim());
    return {
      ...b,
      hasPin,
      rsvpToken: token ?? null,
      rsvpPin: pin ?? null,
    };
  });
}

export type RecipientPreviewRow = {
  refType: string;
  refId: string;
  name: string;
  memberNames: string;
  channel: "WHATSAPP" | "EMAIL" | "NONE";
  status: "PENDING" | "SKIPPED";
  skipReason: string | null;
  hasPin: boolean;
  locale: string | null;
};

function toPreviewRow(r: RecipientWithRsvpData): RecipientPreviewRow {
  const channel = r.phone ? "WHATSAPP" : r.email ? "EMAIL" : "NONE";
  return {
    refType: r.refType,
    refId: r.refId,
    name: r.name,
    memberNames: r.memberNames,
    channel,
    status: r.status,
    skipReason: r.skipReason,
    hasPin: r.hasPin,
    locale: r.locale,
  };
}

export async function getInvitationRecipients(
  skipAlreadySent = true,
): Promise<RecipientPreviewRow[] | null> {
  const denied = await denyIfNoEdit();
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
  noPinCount: number;
};

async function progressFor(broadcastId: string): Promise<BroadcastProgress | null> {
  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, kind: "OFFICIAL_INVITATION" },
  });
  if (!broadcast) return null;

  const grouped = await prisma.broadcastRecipient.groupBy({
    by: ["status"],
    where: { broadcastId },
    _count: { _all: true },
  });

  const noPinCount = await prisma.broadcastRecipient.count({
    where: { broadcastId, error: "NO_PIN" },
  });

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
    noPinCount,
  };
}

export async function startInvitationBroadcast(
  skipAlreadySent = true,
): Promise<ActionResult<BroadcastProgress>> {
  const t = await getTranslations("actions.invitations");
  const denied = await denyIfNoManage();
  if (denied) return denied;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: t("unauthorized") };

  if (!rateLimit(`invitation-broadcast:${userId}`, 3, 60_000).ok) {
    return { success: false, error: t("tooManyAttempts") };
  }

  // Preflight de configuração do evento
  const cfg = await getEventConfig();
  if (!cfg.coupleNames || !cfg.eventDate) {
    return { success: false, error: t("eventDateOrCoupleMissing") };
  }

  if (!cfg.invitationMessage || !cfg.invitationMessage.trim()) {
    return { success: false, error: t("messageMissing") };
  }

  const msgVal = validateInvitationMessage(cfg.invitationMessage);
  if (!msgVal.valid) {
    return { success: false, error: t("messageTagsInvalid") };
  }

  if (cfg.invitationRsvpUseExternal) {
    if (!cfg.invitationRsvpUrl) return { success: false, error: t("externalUrlRequired") };
  }

  if (!cfg.invitationRsvpDeadline) {
    return { success: false, error: t("deadlineRequired") };
  }

  const dMatch = cfg.invitationRsvpDeadline.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dMatch) {
    return { success: false, error: t("deadlineInvalidFormat") };
  }
  const [y, m, d] = cfg.invitationRsvpDeadline.split("-").map(Number);
  const deadlineObj = new Date(Date.UTC(y, m - 1, d));
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  if (deadlineObj.getTime() < todayUTC.getTime()) {
    return { success: false, error: t("deadlineInPast") };
  }

  if (cfg.invitationFilePath) {
    try {
      await readUpload(cfg.invitationFilePath);
    } catch {
      return { success: false, error: t("artFileUnreadable") };
    }
  }

  const active = await prisma.broadcast.findFirst({
    where: { kind: "OFFICIAL_INVITATION", status: { in: ["SENDING", "PAUSED"] } },
  });
  if (active) return { success: false, error: t("alreadySending") };

  const recipients = await loadRecipients({ skipAlreadySent });
  if (recipients.length === 0) return { success: false, error: t("noRecipients") };

  const pendingRecipients = recipients.filter((r) => r.status === "PENDING");
  if (pendingRecipients.length === 0) return { success: false, error: t("noEligibleRecipients") };

  const appUrl = getAppUrl();
  const broadcastPayload: BroadcastPayload = {
    version: 1,
    kind: "OFFICIAL_INVITATION",
    message: cfg.invitationMessage,
    rsvpMode: cfg.invitationRsvpUseExternal ? "EXTERNAL" : "NATIVE",
    externalUrl: cfg.invitationRsvpUrl,
    deadline: cfg.invitationRsvpDeadline,
    coupleNames: cfg.coupleNames,
    eventDate: cfg.eventDate.toISOString(),
    daySchedule: cfg.daySchedule,
    artFilePath: cfg.invitationFilePath,
    artFileMime: cfg.invitationFileMime,
    artFileName: cfg.invitationFileName,
    appUrl,
  };

  const broadcast = await prisma.$transaction(async (tx) => {
    const created = await tx.broadcast.create({
      data: {
        kind: "OFFICIAL_INVITATION",
        status: "SENDING",
        channel: "AUTO",
        total: recipients.length,
        payloadJson: JSON.stringify(broadcastPayload),
        startedAt: new Date(),
      },
    });

    await tx.broadcastRecipient.createMany({
      data: recipients.map((r) => {
        const link = resolveRsvpLink({
          rsvpMode: broadcastPayload.rsvpMode,
          externalUrl: broadcastPayload.externalUrl,
          refType: r.refType,
          rsvpToken: r.rsvpToken,
          appUrl,
        });

        const recipientPayload: RecipientPayload = {
          version: 1,
          refType: r.refType,
          refId: r.refId,
          name: r.name,
          memberNames: r.memberNames,
          locale: r.locale || cfg.defaultLocale,
          pin: r.rsvpPin || "",
          rsvpLink: link,
          phone: r.phone,
          email: r.email,
        };

        return {
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
          payloadJson: JSON.stringify(recipientPayload),
        };
      }),
    });

    return created;
  });

  armBroadcastWorker();
  await audit("Broadcast", broadcast.id, "CREATE", {
    kind: "OFFICIAL_INVITATION",
    total: recipients.length,
    eligible: pendingRecipients.length,
  });

  revalidatePath("/dashboard/invitations");

  const progress = await progressFor(broadcast.id);
  return { success: true, data: progress ?? undefined };
}

export async function getActiveInvitationBroadcast(): Promise<BroadcastProgress | null> {
  const denied = await denyIfNoEdit();
  if (denied) return null;
  const latest = await prisma.broadcast.findFirst({
    where: { kind: "OFFICIAL_INVITATION" },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return null;
  return progressFor(latest.id);
}

export async function getInvitationBroadcastProgress(
  broadcastId: string,
): Promise<BroadcastProgress | null> {
  const denied = await denyIfNoEdit();
  if (denied) return null;
  return progressFor(broadcastId);
}

export type BroadcastRecipientRow = {
  id: string;
  name: string;
  memberNames: string;
  channelUsed: string | null;
  status: string;
  error: string | null;
  sentAt: string | null;
};

export async function getInvitationBroadcastRecipients(
  broadcastId: string,
): Promise<BroadcastRecipientRow[] | null> {
  const denied = await denyIfNoEdit();
  if (denied) return null;

  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, kind: "OFFICIAL_INVITATION" },
  });
  if (!broadcast) return null;

  const rows = await prisma.broadcastRecipient.findMany({
    where: { broadcastId },
    select: {
      id: true,
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
    id: r.id,
    name: r.name,
    memberNames: r.memberNames,
    channelUsed: r.channelUsed,
    status: r.status,
    error: r.error,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
  }));
}

export async function resendFailedInvitations(
  broadcastId: string,
  confirmUnknown = false,
): Promise<ActionResult<BroadcastProgress>> {
  const t = await getTranslations("actions.invitations");
  const denied = await denyIfNoManage();
  if (denied) return denied;

  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, kind: "OFFICIAL_INVITATION" },
  });
  if (!broadcast) return { success: false, error: t("broadcastNotFound") };

  const unknownCount = await prisma.broadcastRecipient.count({
    where: { broadcastId, status: "FAILED", error: "DELIVERY_STATE_UNKNOWN" },
  });

  if (unknownCount > 0 && !confirmUnknown) {
    return {
      success: false,
      error: t("confirmUnknownStateRequired", { count: unknownCount }),
    };
  }

  const reset = await prisma.broadcastRecipient.updateMany({
    where: { broadcastId, status: "FAILED" },
    data: { status: "PENDING", error: null, channelUsed: null, sentAt: null, processingStartedAt: null },
  });

  if (reset.count === 0) return { success: false, error: t("noFailedRecipients") };

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "SENDING", finishedAt: null },
  });

  armBroadcastWorker();
  await audit("Broadcast", broadcastId, "UPDATE", { action: "RESEND_FAILED", count: reset.count });
  revalidatePath("/dashboard/invitations");

  const progress = await progressFor(broadcastId);
  return { success: true, data: progress ?? undefined };
}

export async function cancelInvitationBroadcast(broadcastId: string): Promise<ActionResult> {
  const t = await getTranslations("actions.invitations");
  const denied = await denyIfNoManage();
  if (denied) return denied;

  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, kind: "OFFICIAL_INVITATION" },
  });
  if (!broadcast) return { success: false, error: t("broadcastNotFound") };

  await prisma.$transaction([
    prisma.broadcastRecipient.updateMany({
      where: { broadcastId, status: "PENDING" },
      data: { status: "SKIPPED", error: "CANCELLED", processingStartedAt: null },
    }),
    prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "CANCELLED", finishedAt: new Date() },
    }),
  ]);

  await audit("Broadcast", broadcastId, "UPDATE", { action: "CANCEL" });
  revalidatePath("/dashboard/invitations");
  return { success: true };
}

export async function exportInvitationBroadcastCsv(broadcastId: string): Promise<ActionResult<string>> {
  const t = await getTranslations("actions.invitations");
  const denied = await denyIfNoEdit();
  if (denied) return denied;

  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, kind: "OFFICIAL_INVITATION" },
  });
  if (!broadcast) return { success: false, error: t("broadcastNotFound") };

  const recipients = await prisma.broadcastRecipient.findMany({
    where: { broadcastId },
    select: {
      name: true,
      memberNames: true,
      channelUsed: true,
      status: true,
      error: true,
      sentAt: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const sanitizeCell = (val: string | null | undefined): string => {
    if (!val) return "";
    let str = val.replace(/"/g, '""');
    // Formula injection protection for =, +, -, @
    if (/^[=+\-@]/.test(str)) {
      str = `'${str}`;
    }
    return `"${str}"`;
  };

  const headers = ["Nome", "Convidados", "Canal Utilizado", "Status", "Motivo/Erro", "Enviado em"];
  const rows = [headers.map(sanitizeCell).join(",")];

  for (const r of recipients) {
    const sentAtStr = r.sentAt ? r.sentAt.toISOString() : "";
    rows.push(
      [
        r.name,
        r.memberNames,
        r.channelUsed ?? "",
        r.status,
        r.error ?? "",
        sentAtStr,
      ]
        .map(sanitizeCell)
        .join(","),
    );
  }

  // BOM UTF-8 (\uFEFF)
  const csvContent = "\uFEFF" + rows.join("\r\n");
  return { success: true, data: csvContent };
}

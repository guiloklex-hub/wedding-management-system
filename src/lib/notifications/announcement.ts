import { prisma } from "@/lib/prisma";
import { readUpload } from "@/lib/storage";
import { getEventConfig } from "@/lib/event-config";
import { coerceLocale } from "@/i18n/config";
import type { NotifyMedia } from "./index";
import { deliverByChannel, type ChannelPolicy, type DeliveryResult } from "./channel-policy";
import { getAppUrl } from "./official-invitation";
import {
  parseAnnouncementPayload,
  refKey,
  type AnnouncementConfig,
  type AnnouncementContextSnapshot,
  type AnnouncementRecipientPayload,
} from "./announcement-config";
import type { AnnouncementSourceGroup, AnnouncementSourceGuest } from "./announcement-recipients";

export const ANNOUNCEMENT_ART_CID = "announcement-art";

export type AnnouncementContext = {
  config: AnnouncementConfig;
  context: AnnouncementContextSnapshot;
  media?: NotifyMedia;
};

export type AnnouncementContextResult =
  | { ok: true; ctx: AnnouncementContext }
  | { ok: false; error: "INVALID_SNAPSHOT" | "ART_READ_ERROR" };

/** Contexto ao vivo do evento — congelado no payload quando o envio começa. */
export async function buildAnnouncementContext(): Promise<AnnouncementContextSnapshot | null> {
  const cfg = await getEventConfig();
  if (!cfg.coupleNames) return null;
  const venue = await prisma.venue.findFirst({
    where: { deletedAt: null },
    orderBy: [{ isShortlisted: "desc" }, { createdAt: "asc" }],
    select: { name: true },
  });
  const external = Boolean(cfg.invitationRsvpUseExternal && cfg.invitationRsvpUrl);
  return {
    coupleNames: cfg.coupleNames,
    eventDate: cfg.eventDate ? cfg.eventDate.toISOString() : null,
    venueName: venue?.name ?? null,
    siteUrl: cfg.weddingWebsiteUrl,
    registryUrl: cfg.giftRegistryUrl,
    rsvpMode: external ? "EXTERNAL" : "NATIVE",
    externalRsvpUrl: external ? cfg.invitationRsvpUrl : null,
    appUrl: getAppUrl(),
    defaultLocale: cfg.defaultLocale,
  };
}

/** Fontes do público. Nunca expõe PIN nem token — só `hasPin`. */
export async function loadAnnouncementSources(): Promise<{
  groups: AnnouncementSourceGroup[];
  guests: AnnouncementSourceGuest[];
}> {
  const [groups, guests] = await Promise.all([
    prisma.guestGroup.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, contactPhone: true, contactEmail: true, rsvpPin: true },
    }),
    prisma.guest.findMany({
      where: { deletedAt: null, rsvpStatus: { not: "NOT_INVITED" } },
      select: {
        id: true,
        name: true,
        groupId: true,
        rsvpStatus: true,
        side: true,
        isPadrinho: true,
        language: true,
        phone: true,
        email: true,
        rsvpPin: true,
        tags: { select: { tagId: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      contactPhone: g.contactPhone,
      contactEmail: g.contactEmail,
      hasPin: Boolean(g.rsvpPin),
    })),
    guests: guests.map((g) => ({
      id: g.id,
      name: g.name,
      groupId: g.groupId,
      rsvpStatus: g.rsvpStatus,
      side: g.side,
      isPadrinho: g.isPadrinho,
      tagIds: g.tags.map((t) => t.tagId),
      language: g.language,
      phone: g.phone,
      email: g.email,
      hasPin: Boolean(g.rsvpPin),
    })),
  };
}

/** Tokens e PINs de RSVP — usados apenas no início do envio. */
export async function loadRsvpSecrets(): Promise<Map<string, { token: string; pin: string | null }>> {
  const [groups, guests] = await Promise.all([
    prisma.guestGroup.findMany({ where: { deletedAt: null }, select: { id: true, rsvpToken: true, rsvpPin: true } }),
    prisma.guest.findMany({ where: { deletedAt: null }, select: { id: true, rsvpToken: true, rsvpPin: true } }),
  ]);
  const map = new Map<string, { token: string; pin: string | null }>();
  for (const g of groups) map.set(refKey("GuestGroup", g.id), { token: g.rsvpToken, pin: g.rsvpPin });
  for (const g of guests) map.set(refKey("Guest", g.id), { token: g.rsvpToken, pin: g.rsvpPin });
  return map;
}

export async function readAnnouncementMedia(config: AnnouncementConfig): Promise<NotifyMedia | undefined> {
  if (!config.art) return undefined;
  const data = await readUpload(config.art.path);
  return {
    data,
    mimeType: config.art.mime,
    filename: config.art.name,
    inlineCid: config.art.mime.startsWith("image/") ? ANNOUNCEMENT_ART_CID : undefined,
  };
}

export async function loadAnnouncementContextFromPayload(
  payloadJson: string | null,
): Promise<AnnouncementContextResult> {
  const payload = parseAnnouncementPayload(payloadJson);
  if (!payload || !payload.context) return { ok: false, error: "INVALID_SNAPSHOT" };
  try {
    const media = await readAnnouncementMedia(payload.config);
    return { ok: true, ctx: { config: payload.config, context: payload.context, media } };
  } catch (err) {
    console.error("[announcement] falha ao ler a arte", err);
    return { ok: false, error: "ART_READ_ERROR" };
  }
}

export async function sendAnnouncement(args: {
  ctx: AnnouncementContext;
  recipient: AnnouncementRecipientPayload;
  channelOverride?: ChannelPolicy;
  logRef?: { refType: string; refId: string };
}): Promise<DeliveryResult> {
  const { ctx, recipient, channelOverride, logRef } = args;
  const locale = coerceLocale(recipient.locale);
  return deliverByChannel({
    policy: channelOverride ?? ctx.config.channel,
    phone: recipient.phone,
    email: recipient.email,
    locale,
    input: {
      kind: "ANNOUNCEMENT",
      locale,
      title: ctx.config.title,
      coupleNames: ctx.context.coupleNames,
      message: ctx.config.message,
      memberNames: recipient.memberNames,
      eventDate: ctx.context.eventDate,
      venueName: ctx.context.venueName,
      siteUrl: ctx.context.siteUrl,
      registryUrl: ctx.context.registryUrl,
      rsvpLink: recipient.rsvpLink,
      pin: recipient.pin,
      imageCid: ctx.media?.inlineCid ?? null,
    },
    refType: logRef?.refType ?? recipient.refType,
    refId: logRef?.refId ?? recipient.refId,
    media: ctx.media,
  });
}

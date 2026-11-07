import { z } from "zod";

export const ANNOUNCEMENT_KIND = "ANNOUNCEMENT" as const;

/** NOT_INVITED nunca entra no público de um aviso. */
export const ANNOUNCEMENT_RSVP_STATUSES = ["CONFIRMED", "INVITED", "MAYBE", "DECLINED"] as const;
/** UNSET = convidado sem lado definido (`side` nulo). */
export const ANNOUNCEMENT_SIDES = ["NOIVO", "NOIVA", "AMBOS", "UNSET"] as const;
export const PADRINHO_MODES = ["ALL", "ONLY", "EXCLUDE"] as const;
export const ANNOUNCEMENT_CHANNELS = ["AUTO", "WHATSAPP", "EMAIL"] as const;
export const ANNOUNCEMENT_ART_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;

export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_MESSAGE_MAX = 4000;
export const ANNOUNCEMENT_EXCLUDED_REFS_MAX = 2000;

export type AnnouncementRsvpStatus = (typeof ANNOUNCEMENT_RSVP_STATUSES)[number];
export type AnnouncementSide = (typeof ANNOUNCEMENT_SIDES)[number];
export type PadrinhoMode = (typeof PADRINHO_MODES)[number];
export type AnnouncementChannel = (typeof ANNOUNCEMENT_CHANNELS)[number];

const Id = z.string().min(1).max(64);
export const AnnouncementIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const RefKey = z.string().regex(/^(Guest|GuestGroup):[A-Za-z0-9_-]{1,64}$/);

export const AudienceSchema = z.object({
  rsvpStatuses: z.array(z.enum(ANNOUNCEMENT_RSVP_STATUSES)).min(1).max(4),
  includeTagIds: z.array(Id).max(100).default([]),
  excludeTagIds: z.array(Id).max(100).default([]),
  sides: z.array(z.enum(ANNOUNCEMENT_SIDES)).max(4).default([]),
  padrinhos: z.enum(PADRINHO_MODES).default("ALL"),
});
export type Audience = z.infer<typeof AudienceSchema>;

/** O caminho da arte é definido só pelo servidor — nunca aceito do client. */
export const AnnouncementArtSchema = z.object({
  path: z
    .string()
    .max(300)
    .regex(/^announcement\/[A-Za-z0-9_-]{1,64}\/[0-9a-f]{16}_[A-Za-z0-9._-]{1,120}$/),
  mime: z.enum(ANNOUNCEMENT_ART_MIME),
  name: z.string().min(1).max(160),
});
export type AnnouncementArt = z.infer<typeof AnnouncementArtSchema>;

/** Tudo o que o client pode enviar ao salvar um rascunho. */
export const AnnouncementDraftInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(ANNOUNCEMENT_TITLE_MAX)
    .regex(/^[^\r\n]*$/),
  message: z.string().max(ANNOUNCEMENT_MESSAGE_MAX),
  channel: z.enum(ANNOUNCEMENT_CHANNELS),
  audience: AudienceSchema,
  excludedRefs: z.array(RefKey).max(ANNOUNCEMENT_EXCLUDED_REFS_MAX).default([]),
});
export type AnnouncementDraftInput = z.infer<typeof AnnouncementDraftInputSchema>;

export const AnnouncementConfigSchema = AnnouncementDraftInputSchema.extend({
  art: AnnouncementArtSchema.nullable(),
});
export type AnnouncementConfig = z.infer<typeof AnnouncementConfigSchema>;

export const AnnouncementContextSchema = z.object({
  coupleNames: z.string(),
  eventDate: z.string().nullable(),
  venueName: z.string().nullable(),
  siteUrl: z.string().nullable(),
  registryUrl: z.string().nullable(),
  rsvpMode: z.enum(["NATIVE", "EXTERNAL"]),
  externalRsvpUrl: z.string().nullable(),
  appUrl: z.string(),
  defaultLocale: z.string(),
});
export type AnnouncementContextSnapshot = z.infer<typeof AnnouncementContextSchema>;

export const AnnouncementPayloadSchema = z.object({
  version: z.literal(1),
  kind: z.literal(ANNOUNCEMENT_KIND),
  config: AnnouncementConfigSchema,
  /** `null` enquanto rascunho; congelado no início do envio. */
  context: AnnouncementContextSchema.nullable(),
});
export type AnnouncementPayload = z.infer<typeof AnnouncementPayloadSchema>;

export const AnnouncementRecipientPayloadSchema = z.object({
  version: z.literal(1),
  refType: z.enum(["GuestGroup", "Guest"]),
  refId: Id,
  memberNames: z.string(),
  locale: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  rsvpLink: z.string().nullable(),
  pin: z.string().nullable(),
});
export type AnnouncementRecipientPayload = z.infer<typeof AnnouncementRecipientPayloadSchema>;

export const DEFAULT_AUDIENCE: Audience = {
  rsvpStatuses: ["CONFIRMED"],
  includeTagIds: [],
  excludeTagIds: [],
  sides: [],
  padrinhos: "ALL",
};

export function newAnnouncementConfig(title: string): AnnouncementConfig {
  return {
    title: title.slice(0, ANNOUNCEMENT_TITLE_MAX),
    message: "",
    channel: "AUTO",
    audience: { ...DEFAULT_AUDIENCE, rsvpStatuses: [...DEFAULT_AUDIENCE.rsvpStatuses] },
    excludedRefs: [],
    art: null,
  };
}

export function parseAnnouncementPayload(json: string | null | undefined): AnnouncementPayload | null {
  if (!json) return null;
  try {
    const parsed = AnnouncementPayloadSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function refKey(refType: "Guest" | "GuestGroup", refId: string): string {
  return `${refType}:${refId}`;
}

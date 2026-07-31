import { z } from "zod";
import { readUpload } from "@/lib/storage";
import { coerceLocale } from "@/i18n/config";
import { notify, type NotifyMedia, type NotifyResult } from "./index";

export const INVITATION_ART_CID = "invitation-art";

export const MANDATORY_INVITATION_TAGS = ["pin", "link-rsvp", "data-limite"] as const;
export const KNOWN_INVITATION_TAGS = new Set([
  "pin",
  "link-rsvp",
  "data-limite",
  "nomes",
  "convidados",
  "data",
  "local",
]);

export const BroadcastPayloadSchema = z.object({
  version: z.literal(1),
  kind: z.literal("OFFICIAL_INVITATION"),
  message: z.string(),
  rsvpMode: z.enum(["NATIVE", "EXTERNAL"]),
  externalUrl: z.string().nullable(),
  deadline: z.string().nullable(),
  coupleNames: z.string(),
  eventDate: z.string().nullable(),
  daySchedule: z.string().nullable(),
  artFilePath: z.string().nullable(),
  artFileMime: z.string().nullable(),
  artFileName: z.string().nullable(),
  appUrl: z.string(),
});

export type BroadcastPayload = z.infer<typeof BroadcastPayloadSchema>;

export const RecipientPayloadSchema = z.object({
  version: z.literal(1),
  refType: z.enum(["GuestGroup", "Guest"]),
  refId: z.string(),
  name: z.string(),
  memberNames: z.string(),
  locale: z.string(),
  pin: z.string(),
  rsvpLink: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});

export type RecipientPayload = z.infer<typeof RecipientPayloadSchema>;

export function getAppUrl(): string {
  const envUrl = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "http://localhost:3005";
}

export function validateInvitationMessage(message: string): {
  valid: boolean;
  missingMandatory: string[];
  unknownTags: string[];
} {
  const missingMandatory: string[] = [];
  for (const tag of MANDATORY_INVITATION_TAGS) {
    if (!message.includes(`{${tag}}`)) {
      missingMandatory.push(tag);
    }
  }

  const unknownTags: string[] = [];
  const matches = message.matchAll(/\{([a-zA-Z0-9_-]+)\}/g);
  for (const m of matches) {
    const tagName = m[1];
    if (!KNOWN_INVITATION_TAGS.has(tagName) && !unknownTags.includes(tagName)) {
      unknownTags.push(tagName);
    }
  }

  return {
    valid: missingMandatory.length === 0 && unknownTags.length === 0,
    missingMandatory,
    unknownTags,
  };
}

export function resolveRsvpLink(args: {
  rsvpMode: "NATIVE" | "EXTERNAL";
  externalUrl: string | null;
  refType: "GuestGroup" | "Guest";
  rsvpToken: string | null;
  appUrl: string;
}): string {
  if (args.rsvpMode === "EXTERNAL" && args.externalUrl) {
    return args.externalUrl;
  }
  const token = args.rsvpToken ?? "";
  if (args.refType === "GuestGroup") {
    return `${args.appUrl}/rsvp/group/${token}`;
  }
  return `${args.appUrl}/rsvp/${token}`;
}

export type InvitationContext = {
  payload: BroadcastPayload;
  media?: NotifyMedia;
};

export type InvitationContextResult =
  | { ok: true; ctx: InvitationContext }
  | { ok: false; error: "EVENT_NOT_CONFIGURED" | "INVALID_SNAPSHOT" | "ART_READ_ERROR" };

export async function loadInvitationContextFromPayload(
  payloadJson: string,
): Promise<InvitationContextResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(payloadJson);
  } catch {
    return { ok: false, error: "INVALID_SNAPSHOT" };
  }

  const parsed = BroadcastPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_SNAPSHOT" };
  }

  const payload = parsed.data;
  let media: NotifyMedia | undefined;

  if (payload.artFilePath && payload.artFileMime && payload.artFileName) {
    try {
      const data = await readUpload(payload.artFilePath);
      media = {
        data,
        mimeType: payload.artFileMime,
        filename: payload.artFileName,
        inlineCid: payload.artFileMime.startsWith("image/") ? INVITATION_ART_CID : undefined,
      };
    } catch (err) {
      console.error("[official-invitation] Failed to read art file", err);
      return { ok: false, error: "ART_READ_ERROR" };
    }
  }

  return {
    ok: true,
    ctx: {
      payload,
      media,
    },
  };
}

export async function sendInvitation(args: {
  ctx: InvitationContext;
  recipientPayload: RecipientPayload;
  channelOverride?: "WHATSAPP" | "EMAIL";
}): Promise<{ ok: boolean; channelUsed?: "WHATSAPP" | "EMAIL"; error?: string }> {
  const { ctx, recipientPayload, channelOverride } = args;
  const payload = ctx.payload;
  const locale = coerceLocale(recipientPayload.locale);

  const renderInput = {
    kind: "OFFICIAL_INVITATION" as const,
    locale,
    coupleNames: payload.coupleNames,
    recipientNames: recipientPayload.name,
    memberNames: recipientPayload.memberNames,
    customMessage: payload.message,
    pin: recipientPayload.pin,
    rsvpLink: recipientPayload.rsvpLink,
    deadline: payload.deadline,
    eventDate: payload.eventDate,
    daySchedule: payload.daySchedule,
    imageCid: ctx.media?.inlineCid ?? null,
  };

  const tryWa = async (): Promise<NotifyResult> => {
    return notify(
      { phone: recipientPayload.phone, locale },
      renderInput,
      { refType: recipientPayload.refType, refId: recipientPayload.refId, media: ctx.media },
    );
  };

  const tryEmail = async (): Promise<NotifyResult> => {
    return notify(
      { email: recipientPayload.email, locale },
      renderInput,
      { refType: recipientPayload.refType, refId: recipientPayload.refId, media: ctx.media },
    );
  };

  if (channelOverride === "WHATSAPP") {
    if (!recipientPayload.phone) return { ok: false, error: "NO_PHONE" };
    const res = await tryWa();
    if (res.whatsapp.ok) return { ok: true, channelUsed: "WHATSAPP" };
    return { ok: false, error: res.whatsapp.error || "WHATSAPP_FAILED" };
  }

  if (channelOverride === "EMAIL") {
    if (!recipientPayload.email) return { ok: false, error: "NO_EMAIL" };
    const res = await tryEmail();
    if (res.email.ok) return { ok: true, channelUsed: "EMAIL" };
    return { ok: false, error: res.email.error || "EMAIL_FAILED" };
  }

  // Channel policy: AUTO (WhatsApp first, fallback to Email if WhatsApp fails or unavailable)
  if (recipientPayload.phone) {
    const waRes = await tryWa();
    if (waRes.whatsapp.ok) {
      return { ok: true, channelUsed: "WHATSAPP" };
    }
    // WhatsApp failed. Attempt email fallback if available.
    if (recipientPayload.email) {
      const emailRes = await tryEmail();
      if (emailRes.email.ok) {
        return { ok: true, channelUsed: "EMAIL" };
      }
      return {
        ok: false,
        error: `WhatsApp: ${waRes.whatsapp.error || "Failed"}; Email: ${emailRes.email.error || "Failed"}`,
      };
    }
    return { ok: false, error: waRes.whatsapp.error || "WHATSAPP_FAILED" };
  }

  if (recipientPayload.email) {
    const emailRes = await tryEmail();
    if (emailRes.email.ok) {
      return { ok: true, channelUsed: "EMAIL" };
    }
    return { ok: false, error: emailRes.email.error || "EMAIL_FAILED" };
  }

  return { ok: false, error: "NO_CONTACT" };
}

import type { Audience, AnnouncementChannel, AnnouncementSide } from "./announcement-config";
import { refKey } from "./announcement-config";
import { formatList } from "./recipients";
import { toValidMsisdn } from "./std-message";

export type AnnouncementSourceGroup = {
  id: string;
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  hasPin: boolean;
};

export type AnnouncementSourceGuest = {
  id: string;
  name: string;
  groupId: string | null;
  rsvpStatus: string;
  side: string | null;
  isPadrinho: boolean;
  tagIds: string[];
  language: string | null;
  phone: string | null;
  email: string | null;
  hasPin: boolean;
};

export type AnnouncementSkipReason =
  | "MANUAL_EXCLUDED"
  | "NO_PIN"
  | "NO_CONTACT"
  | "NO_PHONE"
  | "NO_EMAIL"
  | "INVALID_PHONE"
  | "DUPLICATE_PHONE"
  | "DUPLICATE_EMAIL";

export type AnnouncementRow = {
  key: string;
  refType: "GuestGroup" | "Guest";
  refId: string;
  name: string;
  members: string[];
  memberNames: string;
  phone: string | null;
  email: string | null;
  locale: string | null;
  plannedChannel: "WHATSAPP" | "EMAIL" | null;
  status: "PENDING" | "SKIPPED";
  skipReason: AnnouncementSkipReason | null;
};

export type AnnouncementSummary = {
  households: number;
  pending: number;
  skipped: number;
  manualExcluded: number;
  guestsReached: number;
};

export type BuildAnnouncementInput = {
  groups: AnnouncementSourceGroup[];
  guests: AnnouncementSourceGuest[];
  audience: Audience;
  channel: AnnouncementChannel;
  excludedRefs: Iterable<string>;
  requirePin: boolean;
  defaultLocale: string;
};

const KNOWN_SIDES = new Set<string>(["NOIVO", "NOIVA", "AMBOS"]);

function sideOf(side: string | null): AnnouncementSide {
  return side && KNOWN_SIDES.has(side) ? (side as AnnouncementSide) : "UNSET";
}

export function guestMatchesAudience(guest: AnnouncementSourceGuest, audience: Audience): boolean {
  if (!(audience.rsvpStatuses as string[]).includes(guest.rsvpStatus)) return false;
  if (audience.includeTagIds.length > 0 && !guest.tagIds.some((id) => audience.includeTagIds.includes(id))) {
    return false;
  }
  if (guest.tagIds.some((id) => audience.excludeTagIds.includes(id))) return false;
  if (audience.sides.length > 0 && !audience.sides.includes(sideOf(guest.side))) return false;
  if (audience.padrinhos === "ONLY" && !guest.isPadrinho) return false;
  if (audience.padrinhos === "EXCLUDE" && guest.isPadrinho) return false;
  return true;
}

function normalizeEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  return v.includes("@") ? v : null;
}

function hasRaw(raw: string | null | undefined): boolean {
  return (raw ?? "").trim() !== "";
}

type Draft = {
  refType: "GuestGroup" | "Guest";
  refId: string;
  name: string;
  members: string[];
  phoneCandidates: (string | null)[];
  emailCandidates: (string | null)[];
  locale: string | null;
  hasPin: boolean;
};

function byName<T extends { name: string; id: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id);
}

/**
 * Monta o público de um aviso: o filtro é aplicado convidado a convidado e o
 * resultado é agrupado por família (uma mensagem por grupo, citando só os
 * integrantes elegíveis) + uma mensagem por convidado avulso elegível.
 */
export function buildAnnouncementRecipients(input: BuildAnnouncementInput): {
  rows: AnnouncementRow[];
  summary: AnnouncementSummary;
} {
  const { audience, channel, requirePin, defaultLocale } = input;
  const excluded = new Set(input.excludedRefs);
  const groupsById = new Map(input.groups.map((g) => [g.id, g]));
  const membersByGroup = new Map<string, AnnouncementSourceGuest[]>();
  const ungrouped: AnnouncementSourceGuest[] = [];

  for (const guest of input.guests) {
    if (guest.groupId && groupsById.has(guest.groupId)) {
      const list = membersByGroup.get(guest.groupId) ?? [];
      list.push(guest);
      membersByGroup.set(guest.groupId, list);
    } else {
      ungrouped.push(guest);
    }
  }

  const drafts: Draft[] = [];
  for (const group of [...input.groups].sort(byName)) {
    const members = membersByGroup.get(group.id) ?? [];
    const matching = members.filter((m) => guestMatchesAudience(m, audience));
    if (matching.length === 0) continue;
    const others = members.filter((m) => !matching.includes(m));
    drafts.push({
      refType: "GuestGroup",
      refId: group.id,
      name: group.name,
      members: matching.map((m) => m.name),
      phoneCandidates: [group.contactPhone, ...matching.map((m) => m.phone), ...others.map((m) => m.phone)],
      emailCandidates: [group.contactEmail, ...matching.map((m) => m.email), ...others.map((m) => m.email)],
      locale:
        matching.find((m) => m.language)?.language ?? others.find((m) => m.language)?.language ?? null,
      hasPin: group.hasPin,
    });
  }
  for (const guest of [...ungrouped].sort(byName)) {
    if (!guestMatchesAudience(guest, audience)) continue;
    drafts.push({
      refType: "Guest",
      refId: guest.id,
      name: guest.name,
      members: [guest.name],
      phoneCandidates: [guest.phone],
      emailCandidates: [guest.email],
      locale: guest.language,
      hasPin: guest.hasPin,
    });
  }

  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const rows: AnnouncementRow[] = [];
  let guestsReached = 0;

  for (const d of drafts) {
    const key = refKey(d.refType, d.refId);
    const phone = d.phoneCandidates.map(toValidMsisdn).find((p): p is string => Boolean(p)) ?? null;
    const email = d.emailCandidates.map(normalizeEmail).find((e): e is string => Boolean(e)) ?? null;
    const rawPhone = d.phoneCandidates.some(hasRaw);
    const base = {
      key,
      refType: d.refType,
      refId: d.refId,
      name: d.name,
      members: d.members,
      memberNames: formatList(d.members, d.locale ?? defaultLocale),
      locale: d.locale,
    };
    const skip = (reason: AnnouncementSkipReason): AnnouncementRow => ({
      ...base,
      phone,
      email,
      plannedChannel: null,
      status: "SKIPPED",
      skipReason: reason,
    });

    let row: AnnouncementRow;
    if (excluded.has(key)) {
      row = skip("MANUAL_EXCLUDED");
    } else if (requirePin && !d.hasPin) {
      row = skip("NO_PIN");
    } else if (channel === "WHATSAPP") {
      if (!phone) row = skip(rawPhone ? "INVALID_PHONE" : "NO_PHONE");
      else if (seenPhones.has(phone)) row = skip("DUPLICATE_PHONE");
      else {
        seenPhones.add(phone);
        row = { ...base, phone, email: null, plannedChannel: "WHATSAPP", status: "PENDING", skipReason: null };
      }
    } else if (channel === "EMAIL") {
      if (!email) row = skip("NO_EMAIL");
      else if (seenEmails.has(email)) row = skip("DUPLICATE_EMAIL");
      else {
        seenEmails.add(email);
        row = { ...base, phone: null, email, plannedChannel: "EMAIL", status: "PENDING", skipReason: null };
      }
    } else if (!phone && !email) {
      row = skip(rawPhone ? "INVALID_PHONE" : "NO_CONTACT");
    } else if (phone && !seenPhones.has(phone)) {
      seenPhones.add(phone);
      const fallback = email && !seenEmails.has(email) ? email : null;
      row = { ...base, phone, email: fallback, plannedChannel: "WHATSAPP", status: "PENDING", skipReason: null };
    } else if (email && !seenEmails.has(email)) {
      seenEmails.add(email);
      row = { ...base, phone: null, email, plannedChannel: "EMAIL", status: "PENDING", skipReason: null };
    } else {
      row = skip(phone ? "DUPLICATE_PHONE" : "DUPLICATE_EMAIL");
    }

    if (row.status === "PENDING") guestsReached += row.members.length;
    rows.push(row);
  }

  const manualExcluded = rows.filter((r) => r.skipReason === "MANUAL_EXCLUDED").length;
  const pending = rows.filter((r) => r.status === "PENDING").length;
  return {
    rows,
    summary: {
      households: rows.length,
      pending,
      skipped: rows.length - pending - manualExcluded,
      manualExcluded,
      guestsReached,
    },
  };
}

import { coerceLocale, type Locale } from "@/i18n/config";
import { toValidMsisdn } from "./std-message";
import { joinNames } from "./recipients";

const MS_PER_DAY = 86_400_000;

export type RsvpReminderGroupRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  rsvpToken: string;
  createdAt: Date;
  guests: { name: string; phone: string | null; email: string | null; rsvpStatus: string }[];
};

export type RsvpReminderGuestRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  language: string | null;
  rsvpStatus: string;
  rsvpToken: string;
  createdAt: Date;
};

export type RsvpReminderTarget = {
  refType: "Guest" | "GuestGroup";
  refId: string;
  kind: "RSVP_REMINDER" | "RSVP_REMINDER_GROUP";
  /** Nome usado na saudação (convidado, ou contato/nome do grupo). */
  name: string;
  /** Para grupo: integrantes pendentes citados; para avulso: o próprio nome. */
  memberNames: string;
  /** Telefone E.164 enviável (do grupo, ou fallback do 1º integrante). */
  phone: string | null;
  email: string | null;
  /** Token de RSVP (individual ou de grupo) para montar o link. */
  token: string;
  locale: Locale;
  daysInvitedSince: number;
};

function digits(value: string | null): string {
  return (value ?? "").replace(/\D+/g, "");
}

function daysSince(from: Date, today: Date): number {
  return Math.max(1, Math.round((today.getTime() - from.getTime()) / MS_PER_DAY));
}

function firstEmail(rows: { email: string | null }[]): string | null {
  return rows.find((r) => r.email && r.email.trim())?.email ?? null;
}

/**
 * Seleciona quem deve receber o lembrete de RSVP. Considera convidados/grupos
 * convidados (`INVITED`) há pelo menos `days` dias, com contato alcançável,
 * espelhando a resolução de contato do Save the Date (grupo, senão 1º integrante).
 *
 * Determinístico e sem I/O: o caller carrega as linhas e passa `today`,
 * `defaultLocale` e o conjunto `alreadySent` (`${kind}:${refType}:${refId}`).
 * Deduplica por telefone normalizado, com os grupos tendo prioridade sobre os
 * convidados avulsos (evita mandar duas vezes para o mesmo número da família).
 */
export function selectRsvpReminderTargets(input: {
  groups: RsvpReminderGroupRow[];
  guests: RsvpReminderGuestRow[];
  days: number;
  today: Date;
  defaultLocale: Locale;
  alreadySent: Set<string>;
}): RsvpReminderTarget[] {
  const threshold = new Date(input.today.getTime() - input.days * MS_PER_DAY);
  const out: RsvpReminderTarget[] = [];
  const seenPhones = new Set<string>();

  for (const g of input.groups) {
    if (g.createdAt.getTime() > threshold.getTime()) continue;
    const pending = g.guests.filter((m) => m.rsvpStatus === "INVITED");
    if (pending.length === 0) continue;

    const fallbackPhoneMember = g.guests.find((m) => toValidMsisdn(m.phone));
    const phone = toValidMsisdn(g.contactPhone) ?? toValidMsisdn(fallbackPhoneMember?.phone ?? null);
    const email = (g.contactEmail?.trim() ? g.contactEmail : null) ?? firstEmail(g.guests);
    if (!phone && !email) continue;

    const key = `RSVP_REMINDER_GROUP:GuestGroup:${g.id}`;
    if (input.alreadySent.has(key)) continue;

    const d = digits(phone);
    if (d) {
      if (seenPhones.has(d)) continue;
      seenPhones.add(d);
    }

    out.push({
      refType: "GuestGroup",
      refId: g.id,
      kind: "RSVP_REMINDER_GROUP",
      name: g.contactName?.trim() || g.name,
      memberNames: joinNames(pending.map((m) => m.name)),
      phone,
      email,
      token: g.rsvpToken,
      locale: input.defaultLocale,
      daysInvitedSince: daysSince(g.createdAt, input.today),
    });
  }

  for (const guest of input.guests) {
    if (guest.rsvpStatus !== "INVITED") continue;
    if (guest.createdAt.getTime() > threshold.getTime()) continue;

    const phone = toValidMsisdn(guest.phone);
    const email = guest.email?.trim() ? guest.email : null;
    if (!phone && !email) continue;

    const key = `RSVP_REMINDER:Guest:${guest.id}`;
    if (input.alreadySent.has(key)) continue;

    const d = digits(phone);
    if (d) {
      if (seenPhones.has(d)) continue;
      seenPhones.add(d);
    }

    out.push({
      refType: "Guest",
      refId: guest.id,
      kind: "RSVP_REMINDER",
      name: guest.name,
      memberNames: guest.name,
      phone,
      email,
      token: guest.rsvpToken,
      locale: guest.language ? coerceLocale(guest.language) : input.defaultLocale,
      daysInvitedSince: daysSince(guest.createdAt, input.today),
    });
  }

  return out;
}

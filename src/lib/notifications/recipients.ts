import { toValidMsisdn } from "./std-message";

export type RecipientSourceGroup = {
  id: string;
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  memberNames: string[];
  /** Contatos dos integrantes (mesma ordem de `memberNames`), para fallback. */
  memberContacts: { phone: string | null; email: string | null }[];
  memberTagIds: string[];
  hasPadrinho: boolean;
};

export type RecipientSourceGuest = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  language: string | null;
  tagIds: string[];
  isPadrinho: boolean;
};

export type SkipReason =
  | "NO_CONTACT"
  | "INVALID_PHONE"
  | "DUPLICATE_PHONE"
  | "EXCLUDED_TAG"
  | "ALREADY_SENT";

export type BuiltRecipient = {
  refType: "GuestGroup" | "Guest";
  refId: string;
  name: string;
  memberNames: string;
  phone: string | null;
  email: string | null;
  locale: string | null;
  status: "PENDING" | "SKIPPED";
  skipReason: SkipReason | null;
};

export type RecipientExcludeOptions = {
  excludeTagIds?: string[];
  excludePadrinhos?: boolean;
  /** Chaves `${refType}:${refId}` que já receberam (dedup entre disparos). */
  alreadySentKeys?: Set<string>;
};

function digits(value?: string | null): string {
  return (value ?? "").replace(/\D+/g, "");
}

/** "Ana", "Ana e Lucas", "Ana, Beto e Lucas". */
export function joinNames(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} e ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} e ${clean[clean.length - 1]}`;
}

/**
 * Monta a lista de destinatários do Save the Date: uma entrada por grupo
 * (telefone/e-mail do grupo, citando os integrantes) + uma por convidado avulso
 * (sem grupo). Telefones são normalizados (E.164, preservando DDI estrangeiro).
 *
 * O contato de um grupo usa `contactPhone`/`contactEmail`; quando vazios, cai para o
 * telefone/e-mail do primeiro integrante que tiver (fallback).
 *
 * Regras de `SKIPPED` (nesta ordem de prioridade):
 *   EXCLUDED_TAG    → tem tag excluída ou é padrinho (quando ligado)
 *   ALREADY_SENT    → já recebeu num disparo anterior
 *   DUPLICATE_PHONE → telefone (válido) repetido entre grupo e avulso
 *   INVALID_PHONE   → tinha telefone mas fora do formato enviável e sem e-mail
 *   NO_CONTACT      → sem telefone e sem e-mail
 */
export function buildSaveTheDateRecipients(
  groups: RecipientSourceGroup[],
  guests: RecipientSourceGuest[],
  opts: RecipientExcludeOptions = {},
): BuiltRecipient[] {
  const out: BuiltRecipient[] = [];
  const seenPhones = new Set<string>();
  const excludeTags = new Set(opts.excludeTagIds ?? []);
  const padrinhos = opts.excludePadrinhos ?? false;
  const alreadySent = opts.alreadySentKeys ?? new Set<string>();

  const isExcludedByTag = (tagIds: string[], hasPadrinho: boolean): boolean => {
    if (padrinhos && hasPadrinho) return true;
    if (excludeTags.size === 0) return false;
    return tagIds.some((id) => excludeTags.has(id));
  };

  /**
   * Decide o canal/skip. `rawPhone` é o telefone candidato (pode ser inválido);
   * `validPhone` é a versão E.164 enviável (ou null). Retorna também o telefone
   * efetivo a persistir no destinatário (só números válidos viram WhatsApp).
   */
  const classify = (
    key: string,
    rawPhone: string | null,
    validPhone: string | null,
    email: string | null,
    tagIds: string[],
    hasPadrinho: boolean,
  ): { status: "PENDING" | "SKIPPED"; skipReason: SkipReason | null } => {
    if (isExcludedByTag(tagIds, hasPadrinho)) {
      return { status: "SKIPPED", skipReason: "EXCLUDED_TAG" };
    }
    if (alreadySent.has(key)) return { status: "SKIPPED", skipReason: "ALREADY_SENT" };
    if (validPhone) {
      const d = digits(validPhone);
      if (seenPhones.has(d)) return { status: "SKIPPED", skipReason: "DUPLICATE_PHONE" };
      seenPhones.add(d);
      return { status: "PENDING", skipReason: null };
    }
    if (email) return { status: "PENDING", skipReason: null };
    if (rawPhone && rawPhone.trim()) return { status: "SKIPPED", skipReason: "INVALID_PHONE" };
    return { status: "SKIPPED", skipReason: "NO_CONTACT" };
  };

  const firstWith = <K extends "phone" | "email">(
    contacts: { phone: string | null; email: string | null }[],
    field: K,
  ): string | null => contacts.find((c) => c[field] && c[field]!.trim())?.[field] ?? null;

  for (const grp of groups) {
    const rawPhone = grp.contactPhone ?? firstWith(grp.memberContacts, "phone");
    const email = grp.contactEmail ?? firstWith(grp.memberContacts, "email");
    const validPhone = toValidMsisdn(rawPhone);
    const key = `GuestGroup:${grp.id}`;
    const { status, skipReason } = classify(
      key,
      rawPhone,
      validPhone,
      email,
      grp.memberTagIds,
      grp.hasPadrinho,
    );
    const members = grp.memberNames.length > 0 ? grp.memberNames : [grp.name];
    out.push({
      refType: "GuestGroup",
      refId: grp.id,
      name: grp.name,
      memberNames: joinNames(members),
      phone: validPhone,
      email,
      locale: null,
      status,
      skipReason,
    });
  }

  for (const gst of guests) {
    const validPhone = toValidMsisdn(gst.phone);
    const key = `Guest:${gst.id}`;
    const { status, skipReason } = classify(
      key,
      gst.phone,
      validPhone,
      gst.email,
      gst.tagIds,
      gst.isPadrinho,
    );
    out.push({
      refType: "Guest",
      refId: gst.id,
      name: gst.name,
      memberNames: gst.name,
      phone: validPhone,
      email: gst.email,
      locale: gst.language,
      status,
      skipReason,
    });
  }

  return out;
}

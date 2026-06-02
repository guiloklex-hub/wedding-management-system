import { normalizeMsisdn } from "./std-message";

export type RecipientSourceGroup = {
  id: string;
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  memberNames: string[];
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

export type SkipReason = "NO_CONTACT" | "DUPLICATE_PHONE" | "EXCLUDED_TAG" | "ALREADY_SENT";

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
 * Regras de `SKIPPED` (nesta ordem de prioridade):
 *   EXCLUDED_TAG  → tem tag excluída ou é padrinho (quando ligado)
 *   ALREADY_SENT  → já recebeu num disparo anterior
 *   NO_CONTACT    → sem telefone e sem e-mail
 *   DUPLICATE_PHONE → telefone repetido entre grupo e avulso
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

  const classify = (
    key: string,
    phone: string | null,
    email: string | null,
    tagIds: string[],
    hasPadrinho: boolean,
  ): { status: "PENDING" | "SKIPPED"; skipReason: SkipReason | null } => {
    if (isExcludedByTag(tagIds, hasPadrinho)) {
      return { status: "SKIPPED", skipReason: "EXCLUDED_TAG" };
    }
    if (alreadySent.has(key)) return { status: "SKIPPED", skipReason: "ALREADY_SENT" };
    if (!phone && !email) return { status: "SKIPPED", skipReason: "NO_CONTACT" };
    const d = digits(phone);
    if (d && seenPhones.has(d)) return { status: "SKIPPED", skipReason: "DUPLICATE_PHONE" };
    if (d) seenPhones.add(d);
    return { status: "PENDING", skipReason: null };
  };

  for (const grp of groups) {
    const phone = normalizeMsisdn(grp.contactPhone);
    const key = `GuestGroup:${grp.id}`;
    const { status, skipReason } = classify(
      key,
      phone,
      grp.contactEmail,
      grp.memberTagIds,
      grp.hasPadrinho,
    );
    const members = grp.memberNames.length > 0 ? grp.memberNames : [grp.name];
    out.push({
      refType: "GuestGroup",
      refId: grp.id,
      name: grp.name,
      memberNames: joinNames(members),
      phone,
      email: grp.contactEmail,
      locale: null,
      status,
      skipReason,
    });
  }

  for (const gst of guests) {
    const phone = normalizeMsisdn(gst.phone);
    const key = `Guest:${gst.id}`;
    const { status, skipReason } = classify(key, phone, gst.email, gst.tagIds, gst.isPadrinho);
    out.push({
      refType: "Guest",
      refId: gst.id,
      name: gst.name,
      memberNames: gst.name,
      phone,
      email: gst.email,
      locale: gst.language,
      status,
      skipReason,
    });
  }

  return out;
}

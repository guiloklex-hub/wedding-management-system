import { toValidMsisdn } from "@/lib/notifications/std-message";

export type GroupMemberRef = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  rsvpStatus: string;
};

export type SummarizableGroup = {
  contactPhone: string | null;
  contactEmail: string | null;
  guests: GroupMemberRef[];
};

export type GroupSummary = {
  memberCount: number;
  confirmed: number;
  declined: number;
  /** Integrantes que ainda não confirmaram nem recusaram. */
  pending: number;
  /** Telefone E.164 enviável (do grupo, ou fallback do 1º integrante). */
  effectivePhone: string | null;
  /** E-mail (do grupo, ou fallback do 1º integrante). */
  effectiveEmail: string | null;
  /** Há algum canal alcançável para o Save the Date? */
  willReceive: boolean;
  /** O contato veio de um integrante (grupo sem contato próprio)? */
  usesFallback: boolean;
  /** Nome do integrante usado como fallback (quando `usesFallback`). */
  fallbackName: string | null;
};

/**
 * Resume um grupo para a tela de Grupos. A resolução de contato espelha
 * exatamente `buildSaveTheDateRecipients` (src/lib/notifications/recipients.ts):
 * usa o contato do grupo e, na ausência, cai para o primeiro integrante com
 * telefone válido / e-mail — para que o aviso "sem contato" do card reflita o
 * que o disparo realmente faria.
 */
export function summarizeGroup(group: SummarizableGroup): GroupSummary {
  const members = group.guests;
  const memberCount = members.length;
  const confirmed = members.filter((m) => m.rsvpStatus === "CONFIRMED").length;
  const declined = members.filter((m) => m.rsvpStatus === "DECLINED").length;
  const pending = memberCount - confirmed - declined;

  const ownPhone = toValidMsisdn(group.contactPhone);
  const ownEmail = group.contactEmail?.trim() ? group.contactEmail : null;

  const fallbackPhoneMember = ownPhone
    ? null
    : members.find((m) => toValidMsisdn(m.phone)) ?? null;
  const fallbackEmailMember = ownEmail
    ? null
    : members.find((m) => m.email?.trim()) ?? null;

  const effectivePhone = ownPhone ?? toValidMsisdn(fallbackPhoneMember?.phone);
  const effectiveEmail = ownEmail ?? fallbackEmailMember?.email ?? null;
  const willReceive = Boolean(effectivePhone || effectiveEmail);

  const fallbackMember = fallbackPhoneMember ?? fallbackEmailMember;
  const usesFallback = willReceive && !ownPhone && !ownEmail && fallbackMember !== null;

  return {
    memberCount,
    confirmed,
    declined,
    pending,
    effectivePhone,
    effectiveEmail,
    willReceive,
    usesFallback,
    fallbackName: usesFallback ? (fallbackMember?.name ?? null) : null,
  };
}

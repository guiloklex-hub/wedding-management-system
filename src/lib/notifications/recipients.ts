export type RecipientSourceGroup = {
  id: string;
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  memberNames: string[];
};

export type RecipientSourceGuest = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  language: string | null;
};

export type SkipReason = "NO_CONTACT" | "DUPLICATE_PHONE";

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
 * (sem grupo). Quem não tem nenhum canal vira `SKIPPED`; telefones repetidos
 * entre grupo e avulso também são pulados para não duplicar o envio.
 */
export function buildSaveTheDateRecipients(
  groups: RecipientSourceGroup[],
  guests: RecipientSourceGuest[],
): BuiltRecipient[] {
  const out: BuiltRecipient[] = [];
  const seenPhones = new Set<string>();

  const classify = (phone: string | null, email: string | null): {
    status: "PENDING" | "SKIPPED";
    skipReason: SkipReason | null;
  } => {
    if (!phone && !email) return { status: "SKIPPED", skipReason: "NO_CONTACT" };
    const key = digits(phone);
    if (key && seenPhones.has(key)) {
      return { status: "SKIPPED", skipReason: "DUPLICATE_PHONE" };
    }
    if (key) seenPhones.add(key);
    return { status: "PENDING", skipReason: null };
  };

  for (const grp of groups) {
    const { status, skipReason } = classify(grp.contactPhone, grp.contactEmail);
    const members = grp.memberNames.length > 0 ? grp.memberNames : [grp.name];
    out.push({
      refType: "GuestGroup",
      refId: grp.id,
      name: grp.name,
      memberNames: joinNames(members),
      phone: grp.contactPhone,
      email: grp.contactEmail,
      locale: null,
      status,
      skipReason,
    });
  }

  for (const gst of guests) {
    const { status, skipReason } = classify(gst.phone, gst.email);
    out.push({
      refType: "Guest",
      refId: gst.id,
      name: gst.name,
      memberNames: gst.name,
      phone: gst.phone,
      email: gst.email,
      locale: gst.language,
      status,
      skipReason,
    });
  }

  return out;
}

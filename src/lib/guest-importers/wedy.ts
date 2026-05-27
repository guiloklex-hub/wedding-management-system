import type { Importer, ImportedRsvpStatus, ParsedRow, RecordRow } from "./types";

const EXPECTED_HEADERS = [
  "Nome do convite",
  "Nome completo do convidado",
  "Status",
  "Telefone",
  "E-mail",
  "Tags",
  "Faixa etária",
  "Idade exata (caso for criança)",
  "Pin do convite",
] as const;

const STATUS_MAP: Record<string, ImportedRsvpStatus> = {
  "sem resposta": "INVITED",
  "convidado": "INVITED",
  "confirmado": "CONFIRMED",
  "confirmada": "CONFIRMED",
  "vai": "CONFIRMED",
  "recusado": "DECLINED",
  "recusada": "DECLINED",
  "não vai": "DECLINED",
  "nao vai": "DECLINED",
  "talvez": "MAYBE",
  "não convidado": "NOT_INVITED",
  "nao convidado": "NOT_INVITED",
};

const PIN_RE = /^[A-Z0-9]{4,8}$/i;

function get(rec: RecordRow, header: string): string {
  return (rec[header] ?? "").trim();
}

export const wedyImporter: Importer = {
  id: "wedy",
  label: "Wedy",
  contactsBelongToGroup: true,

  detect(_records, headers) {
    const matches = EXPECTED_HEADERS.filter((h) => headers.includes(h)).length;
    return matches >= 6;
  },

  parseRecords(records) {
    const rows: ParsedRow[] = [];
    for (const rec of records) {
      const name = get(rec, "Nome completo do convidado").slice(0, 160);
      if (!name) continue;

      const groupName = get(rec, "Nome do convite").slice(0, 80) || null;
      const phone = get(rec, "Telefone").slice(0, 40) || null;
      const email = get(rec, "E-mail").slice(0, 160) || null;
      const statusRaw = get(rec, "Status");
      const statusKey = statusRaw.toLowerCase();
      const rsvpStatus = STATUS_MAP[statusKey] ?? "INVITED";

      const tagsRaw = get(rec, "Tags");
      const tags = tagsRaw
        ? tagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];

      const isChild = get(rec, "Faixa etária").toLowerCase() === "criança";
      const ageRaw = get(rec, "Idade exata (caso for criança)");
      const ageNum = /^\d{1,3}$/.test(ageRaw) ? parseInt(ageRaw, 10) : null;
      const age = ageNum != null && ageNum >= 0 && ageNum <= 17 ? ageNum : null;

      const pinRaw = get(rec, "Pin do convite");
      const pin = PIN_RE.test(pinRaw) ? pinRaw : null;

      const rawSource: Record<string, string> = {};
      for (const h of EXPECTED_HEADERS) rawSource[h] = get(rec, h);

      rows.push({
        name,
        groupName,
        phone,
        email,
        rsvpStatus,
        rsvpStatusRaw: statusRaw || null,
        tags,
        isChild,
        age,
        pin,
        rawSource,
      });
    }
    return rows;
  },
};

import type { GuestSide, Importer, ImportedRsvpStatus, ParsedRow, RecordRow } from "./types";

const EXPECTED_HEADERS = [
  "Nome",
  "Telefone",
  "Email",
  "Lado",
  "Grupo",
  "Status",
  "+1 confirmados",
  "Mesa",
  "Restrições",
  "Cidade",
  "Padrinho",
  "VIP",
  "Criança",
] as const;

// Labels que o próprio sistema usa em RSVP_LABEL no client.
const STATUS_MAP: Record<string, ImportedRsvpStatus> = {
  "não convidado": "NOT_INVITED",
  "nao convidado": "NOT_INVITED",
  "convidado": "INVITED",
  "confirmado": "CONFIRMED",
  "confirmada": "CONFIRMED",
  "recusou": "DECLINED",
  "recusado": "DECLINED",
  "talvez": "MAYBE",
};

function get(rec: RecordRow, header: string): string {
  return (rec[header] ?? "").trim();
}

function parseBool(v: string): boolean {
  const n = v.trim().toLowerCase();
  return n === "sim" || n === "true" || n === "1" || n === "yes";
}

function parseSide(v: string): GuestSide | null {
  const n = v.trim().toUpperCase();
  return n === "NOIVO" || n === "NOIVA" || n === "AMBOS" ? n : null;
}

export const internalCsvImporter: Importer = {
  id: "internal-csv",
  label: "CSV exportado pelo próprio sistema",
  contactsBelongToGroup: false,

  detect(_records, headers) {
    // Header obrigatório: deve ter Nome, Status, Grupo e pelo menos 8 das 13.
    const must = ["Nome", "Status", "Grupo"];
    if (!must.every((h) => headers.includes(h))) return false;
    const matches = EXPECTED_HEADERS.filter((h) => headers.includes(h)).length;
    return matches >= 8;
  },

  parseRecords(records) {
    const rows: ParsedRow[] = [];
    for (const rec of records) {
      const name = get(rec, "Nome").slice(0, 160);
      if (!name) continue;

      const groupName = get(rec, "Grupo").slice(0, 80) || null;
      const phone = get(rec, "Telefone").slice(0, 40) || null;
      const email = get(rec, "Email").slice(0, 160) || null;
      const statusRaw = get(rec, "Status");
      const statusKey = statusRaw.toLowerCase();
      const rsvpStatus = STATUS_MAP[statusKey] ?? "INVITED";
      const side = parseSide(get(rec, "Lado"));
      const isChild = parseBool(get(rec, "Criança"));
      const isVIP = parseBool(get(rec, "VIP"));
      const isPadrinhoCol = parseBool(get(rec, "Padrinho"));

      const plusStr = get(rec, "+1 confirmados");
      const plusNum = /^\d{1,2}$/.test(plusStr) ? parseInt(plusStr, 10) : null;
      const plusOnesAllowed =
        plusNum != null && plusNum >= 0 && plusNum <= 10 ? plusNum : undefined;

      const tableNumber = get(rec, "Mesa").slice(0, 20) || null;
      const dietary = get(rec, "Restrições").slice(0, 200) || null;
      const city = get(rec, "Cidade").slice(0, 80) || null;

      // Reaproveita "Padrinho" da coluna como uma tag virtual para o pipeline
      // de tags + isPadrinho na Server Action (commitGuestImport). Idempotente
      // com a regex flexível usada lá.
      const tags = isPadrinhoCol ? ["Padrinhos"] : [];

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
        age: null,
        pin: null,
        rawSource,
        side,
        isVIP,
        plusOnesAllowed,
        tableNumber,
        dietary,
        city,
      });
    }
    return rows;
  },
};

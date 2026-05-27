import ExcelJS from "exceljs";
import type { Importer, ImportedRsvpStatus, ParsedRow } from "./types";

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

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((rt) => rt.text).join("");
  }
  if (typeof value === "object" && "result" in value) {
    return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value);
}

function readHeader(worksheet: ExcelJS.Worksheet): string[] {
  const headerRow = worksheet.getRow(1);
  const values = headerRow.values as unknown[];
  // ExcelJS retorna array 1-indexed; índice 0 é undefined.
  return values.slice(1).map((v) => cellText(v as ExcelJS.CellValue).trim());
}

async function loadWorkbook(buf: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf as unknown as ArrayBuffer);
  return workbook;
}

export const wedyImporter: Importer = {
  id: "wedy",
  label: "Wedy",
  async detect(buf) {
    try {
      const workbook = await loadWorkbook(buf);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) return false;
      const headers = readHeader(worksheet);
      const matches = EXPECTED_HEADERS.filter((h) => headers.includes(h)).length;
      return matches >= 6;
    } catch {
      return false;
    }
  },

  async parse(buf) {
    const workbook = await loadWorkbook(buf);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const headers = readHeader(worksheet);
    const colIndex = new Map<string, number>();
    headers.forEach((h, i) => {
      if (h) colIndex.set(h, i + 1);
    });

    const get = (row: ExcelJS.Row, header: string): string => {
      const idx = colIndex.get(header);
      if (!idx) return "";
      return cellText(row.getCell(idx).value).trim();
    };

    const rows: ParsedRow[] = [];
    const totalRows = worksheet.actualRowCount;

    for (let r = 2; r <= totalRows; r++) {
      const row = worksheet.getRow(r);
      const name = get(row, "Nome completo do convidado").slice(0, 160);
      if (!name) continue;

      const groupName = get(row, "Nome do convite").slice(0, 80) || null;
      const phone = get(row, "Telefone").slice(0, 40) || null;
      const email = get(row, "E-mail").slice(0, 160) || null;
      const statusRaw = get(row, "Status");
      const statusKey = statusRaw.toLowerCase();
      const rsvpStatus = STATUS_MAP[statusKey] ?? "INVITED";

      const tagsRaw = get(row, "Tags");
      const tags = tagsRaw
        ? tagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];

      const isChild = get(row, "Faixa etária").toLowerCase() === "criança";

      const ageRaw = get(row, "Idade exata (caso for criança)");
      const ageNum = /^\d{1,3}$/.test(ageRaw) ? parseInt(ageRaw, 10) : null;
      const age = ageNum != null && ageNum >= 0 && ageNum <= 17 ? ageNum : null;

      const pinRaw = get(row, "Pin do convite");
      const pin = PIN_RE.test(pinRaw) ? pinRaw : null;

      const rawSource: Record<string, string> = {};
      for (const h of EXPECTED_HEADERS) rawSource[h] = get(row, h);

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

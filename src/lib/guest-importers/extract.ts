import ExcelJS from "exceljs";
import { FileValidationError } from "@/lib/file-validation";
import type { RecordRow } from "./types";

export type ExtractedSheet = {
  headers: string[];
  records: RecordRow[];
};

function cellToString(value: ExcelJS.CellValue): string {
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
    return cellToString(value.result as ExcelJS.CellValue);
  }
  return String(value);
}

export async function extractXlsxRecords(buf: Buffer): Promise<ExtractedSheet> {
  let workbook: ExcelJS.Workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new FileValidationError("Não foi possível ler o arquivo XLSX.");
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headers: [], records: [] };

  const headerRow = worksheet.getRow(1);
  const rawHeaders = (headerRow.values as unknown[]).slice(1);
  const headers = rawHeaders.map((v) => cellToString(v as ExcelJS.CellValue).trim());

  const records: RecordRow[] = [];
  const totalRows = worksheet.actualRowCount;
  for (let r = 2; r <= totalRows; r++) {
    const row = worksheet.getRow(r);
    const rec: RecordRow = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      rec[h] = cellToString(row.getCell(idx + 1).value).trim();
    });
    records.push(rec);
  }
  return { headers, records };
}

function detectCsvSeparator(line: string): "," | ";" | "\t" {
  const tabCount = (line.match(/\t/g) ?? []).length;
  const commaCount = (line.match(/,/g) ?? []).length;
  const semiCount = (line.match(/;/g) ?? []).length;
  if (tabCount >= commaCount && tabCount >= semiCount && tabCount > 0) return "\t";
  if (semiCount > commaCount) return ";";
  return ",";
}

/** Parser CSV simples com suporte a aspas duplas (`""` escape). */
function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"' && cur.length === 0) {
        inQuotes = true;
      } else if (ch === sep) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

export function extractCsvRecords(text: string): ExtractedSheet {
  // BOM UTF-8 (Excel costuma exportar com BOM).
  const clean = text.replace(/^﻿/, "");
  // Reagrupa linhas considerando quebras dentro de aspas.
  const lines: string[] = [];
  let buffer = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        buffer += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        buffer += ch;
      }
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      if (buffer.length > 0) {
        lines.push(buffer);
        buffer = "";
      }
    } else {
      buffer += ch;
    }
  }
  if (buffer.length > 0) lines.push(buffer);

  if (lines.length === 0) return { headers: [], records: [] };
  const sep = detectCsvSeparator(lines[0]);
  const headers = parseCsvLine(lines[0], sep).map((h) => h.trim());

  const records: RecordRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const parts = parseCsvLine(lines[r], sep);
    if (parts.every((p) => p.trim() === "")) continue;
    const rec: RecordRow = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      rec[h] = (parts[idx] ?? "").trim();
    });
    records.push(rec);
  }
  return { headers, records };
}

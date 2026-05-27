import { wedyImporter } from "./wedy";
import { internalCsvImporter } from "./internal-csv";
import type { Importer, ImporterId, RecordRow } from "./types";

export const IMPORTERS: Record<ImporterId, Importer> = {
  wedy: wedyImporter,
  "internal-csv": internalCsvImporter,
};

export const IMPORTER_OPTIONS: Array<{ id: ImporterId; label: string }> = Object.values(
  IMPORTERS,
).map((imp) => ({ id: imp.id, label: imp.label }));

export function detectImporter(records: RecordRow[], headers: string[]): Importer | null {
  for (const importer of Object.values(IMPORTERS)) {
    try {
      if (importer.detect(records, headers)) return importer;
    } catch {
      // ignora e tenta o próximo
    }
  }
  return null;
}

export { extractXlsxRecords, extractCsvRecords } from "./extract";
export type { ExtractedSheet } from "./extract";
export type {
  Importer,
  ImporterId,
  ParsedRow,
  ImportedRsvpStatus,
  RecordRow,
} from "./types";

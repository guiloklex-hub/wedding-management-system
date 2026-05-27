import { wedyImporter } from "./wedy";
import type { Importer, ImporterId } from "./types";

export const IMPORTERS: Record<ImporterId, Importer> = {
  wedy: wedyImporter,
};

export const IMPORTER_OPTIONS: Array<{ id: ImporterId; label: string }> = Object.values(
  IMPORTERS,
).map((imp) => ({ id: imp.id, label: imp.label }));

export async function detectImporter(buf: Buffer): Promise<Importer | null> {
  for (const importer of Object.values(IMPORTERS)) {
    try {
      const ok = await importer.detect(buf);
      if (ok) return importer;
    } catch {
      // continua tentando os próximos
    }
  }
  return null;
}

export type { Importer, ImporterId, ParsedRow, ImportedRsvpStatus } from "./types";

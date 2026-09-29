import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { safeArchiveName, sha256File, sqliteSchemaHash, withPortableFile, type OpenPortable, type PortableManifest } from "./portable-format";
import { assertWebContractCoverage, type MobileFile, type MobileRecord, type Row } from "./portable-projection";
import { mergeMobileRecords, prepareAndroidBase } from "./portable-merge";
import { databasePath } from "./portable-export";

export type PortablePreview = {
  manifest: PortableManifest;
  recordsByArea: Record<string, number>;
  webTables: Record<string, number>;
  uploadCount: number;
  uploadBytes: number;
  requiredBytes: number;
  changedRecords: number;
  createdRecords: number;
  deletedRecords: number;
  blockers: string[];
};

export type InspectedPortable = {
  preview: PortablePreview;
  records: MobileRecord[];
  baseline: MobileRecord[];
  files: MobileFile[];
  archive: OpenPortable;
};

function failUnless(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function inspectPortable<T>(source: string, password: string,
  operation: (result: InspectedPortable) => Promise<T>): Promise<T> {
  return withPortableFile(source, password, async (archive) => {
    const { manifest, entries } = archive;
    failUnless(manifest.origin === "web" || manifest.origin === "android", "Origem inválida");
    failUnless(Number.isSafeInteger(manifest.generation) && manifest.generation > 0, "Geração inválida");
    failUnless(typeof manifest.lineageId === "string" && manifest.lineageId.length > 0, "Linhagem inválida");
    failUnless(manifest.hashes && manifest.uploads && manifest.webTables, "Manifesto incompleto");
    failUnless(manifest.schemas?.android === 2 &&
      (manifest.webDatabase ? typeof manifest.schemas.web === "string" : manifest.schemas.web === null),
      "Versões de esquema não suportadas");
    const records = await archive.readJson<MobileRecord[]>("records.json");
    const baseline = await archive.readJson<MobileRecord[]>("baseline.json");
    const files = await archive.readJson<MobileFile[]>("files.json");
    await archive.readJson<unknown[]>("settings.json");
    await archive.readJson<unknown[]>("audit.json");
    failUnless(Array.isArray(records) && Array.isArray(baseline) && Array.isArray(files), "Registros inválidos");
    failUnless(records.length === manifest.records && files.length === manifest.files, "Contagens divergentes");
    const recordIds = new Set<string>();
    for (const record of records) {
      failUnless(typeof record.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(record.id) &&
        typeof record.kind === "string" && typeof record.title === "string", "Registro inválido");
      failUnless(!recordIds.has(record.id), `Registro repetido: ${record.id}`);
      recordIds.add(record.id);
    }
    const baselineIds = new Set<string>();
    for (const record of baseline) {
      failUnless(typeof record.id === "string" && !baselineIds.has(record.id), "Referência inicial inválida");
      baselineIds.add(record.id);
    }
    for (const record of records) {
      for (const relation of [record.parentId, record.guestGroupId, record.seatingTableId]) {
        failUnless(!relation || recordIds.has(relation), `Relação ausente: ${record.id}`);
      }
    }
    const expected = new Set(["manifest.json", "records.json", "baseline.json", "files.json", "settings.json", "audit.json"]);
    const blockers: string[] = [];
    let uploadBytes = 0;
    for (const file of files) {
      failUnless(typeof file.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(file.id), "ID de arquivo inválido");
      failUnless(!file.recordId || recordIds.has(file.recordId), `Arquivo sem registro: ${file.id}`);
      failUnless(manifest.hashes[file.id] === file.sha256, `Hash de arquivo inconsistente: ${file.id}`);
      const name = `blobs/${file.id}`;
      failUnless(!expected.has(name), `Arquivo repetido: ${file.id}`);
      expected.add(name);
    }
    for (const [relative, metadata] of Object.entries(manifest.uploads)) {
      failUnless(safeArchiveName(relative) && metadata && typeof metadata.sha256 === "string" &&
        Number.isSafeInteger(metadata.size) && metadata.size >= 0, `Caminho de upload inválido: ${relative}`);
      uploadBytes += metadata.size;
      expected.add(`uploads/${relative}`);
    }
    if (manifest.webDatabase) expected.add("web.sqlite");
    failUnless(entries.size === expected.size && [...entries.keys()].every((name) => expected.has(name)),
      "Entradas ausentes ou inesperadas");
    const temporary = await fs.mkdtemp(path.join(tmpdir(), "wfp-inspect-"));
    try {
      for (const file of files) {
        const name = `blobs/${file.id}`;
        const target = path.join(temporary, file.id);
        await archive.extract(name, target);
        const actual = await sha256File(target);
        failUnless(actual.sha256 === file.sha256 && actual.size === file.byteSize, `Arquivo alterado: ${file.fileName}`);
      }
      for (const [relative, metadata] of Object.entries(manifest.uploads)) {
        const target = path.join(temporary, "uploads", relative);
        await archive.extract(`uploads/${relative}`, target);
        const actual = await sha256File(target);
        failUnless(actual.sha256 === metadata.sha256 && actual.size === metadata.size, `Upload alterado: ${relative}`);
      }
      if (manifest.webDatabase) {
        const snapshot = path.join(temporary, "web.sqlite");
        await archive.extract("web.sqlite", snapshot);
        const hash = await sha256File(snapshot);
        failUnless(hash.sha256 === manifest.webDatabase.sha256 && hash.size === manifest.webDatabase.size,
          "Banco web alterado");
        const db = new DatabaseSync(snapshot, { readOnly: true });
        try {
          failUnless(db.prepare("PRAGMA quick_check").get()?.quick_check === "ok" &&
            !db.prepare("PRAGMA foreign_key_check").get(), "Banco web inválido");
          failUnless(sqliteSchemaHash(db) === manifest.schemas.web, "Esquema web alterado");
          for (const [table, count] of Object.entries(manifest.webTables)) {
            failUnless(/^[A-Za-z_][A-Za-z0-9_]*$/.test(table), "Tabela inválida");
            failUnless(db.prepare(`SELECT count(*) AS n FROM "${table}"`).get()?.n === count,
              `Contagem divergente: ${table}`);
          }
          const contracts = manifest.webTables.Contract == null ? [] :
            db.prepare("SELECT * FROM Contract").all() as Row[];
          const attachments = db.prepare("SELECT * FROM Attachment").all() as Row[];
          assertWebContractCoverage(contracts, attachments, records, files, manifest.uploads);
          const paths = db.prepare("SELECT storagePath FROM Attachment").all() as { storagePath: string }[];
          const event = db.prepare("SELECT invitationFilePath, saveTheDateFilePath FROM EventSettings").get() as
            { invitationFilePath: string | null; saveTheDateFilePath: string | null } | undefined;
          for (const stored of [...paths.map((row) => row.storagePath), event?.invitationFilePath, event?.saveTheDateFilePath]) {
            if (!stored) continue;
            const relative = stored.startsWith("uploads/") ? stored.slice(8) : stored;
            failUnless(safeArchiveName(relative) && relative in manifest.uploads, `Arquivo web ausente: ${stored}`);
          }
        } finally {
          db.close();
        }
        const writable = new DatabaseSync(snapshot);
        try {
          try { mergeMobileRecords(writable, records, baseline); }
          catch (error) { blockers.push((error as Error).message); }
        } finally { writable.close(); }
      } else {
        failUnless(Object.keys(manifest.webTables).length === 0, "Banco web ausente");
        const sourceDb = new DatabaseSync(databasePath(), { readOnly: true });
        const stagedDb = path.join(temporary, "android-base.sqlite");
        try { await backup(sourceDb, stagedDb); } finally { sourceDb.close(); }
        const writable = new DatabaseSync(stagedDb);
        try {
          try {
            prepareAndroidBase(writable);
            mergeMobileRecords(writable, records, baseline);
          } catch (error) { blockers.push((error as Error).message); }
        } finally { writable.close(); }
      }
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
    const prior = new Map(baseline.map((record) => [record.id, record]));
    const current = new Map(records.map((record) => [record.id, record]));
    const changedRecords = records.filter((record) => prior.has(record.id) &&
      JSON.stringify(record) !== JSON.stringify(prior.get(record.id))).length;
    const preview: PortablePreview = {
      manifest, recordsByArea: Object.fromEntries([...new Set(records.map((record) => record.kind))]
        .map((kind) => [kind, records.filter((record) => record.kind === kind).length])),
      webTables: manifest.webTables, uploadCount: Object.keys(manifest.uploads).length,
      uploadBytes, requiredBytes: uploadBytes + (manifest.webDatabase?.size ?? 0) +
        files.reduce((sum, file) => sum + file.byteSize, 0),
      changedRecords, createdRecords: records.filter((record) => !prior.has(record.id)).length,
      deletedRecords: baseline.filter((record) => !current.has(record.id)).length,
      blockers,
    };
    return operation({ preview, records, baseline, files, archive });
  });
}

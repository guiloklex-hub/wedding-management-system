import { randomUUID } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { acquirePortableOperation, clearRestoreJournal, writeRestoreJournal } from "./portable-maintenance";
import { databasePath } from "./portable-export";
import { inspectPortable, type InspectedPortable, type PortablePreview } from "./portable-inspect";
import { mergeMobileRecords, prepareAndroidBase } from "./portable-merge";
import { sha256File } from "./portable-format";

type SettingsRow = { key: string; value: string };
type AuditRow = { id: string; recordId: string | null; action: string; at: number; details: string };

function sqlDate(value: number | null): number | null {
  return value;
}

function safeId(id: string): boolean { return /^[A-Za-z0-9_-]{1,100}$/.test(id); }

async function applyFiles(result: InspectedPortable, database: DatabaseSync, uploads: string, state: string): Promise<void> {
  const { files, records, archive } = result;
  const byId = new Map(records.map((record) => [record.id, record]));
  await fs.mkdir(path.join(state, "blobs"), { recursive: true });
  const existing = database.prepare("SELECT id FROM Attachment").all() as { id: string }[];
  const ids = new Set(files.map((file) => file.id));
  for (const row of existing) if (!ids.has(row.id)) {
    database.prepare("UPDATE Attachment SET deletedAt = ? WHERE id = ?")
      .run(Date.now(), row.id);
  }
  for (const file of files) {
    if (!safeId(file.id)) throw new Error(`ID de arquivo inválido: ${file.id}`);
    const source = `blobs/${file.id}`;
    const stateTarget = path.join(state, "blobs", file.id);
    await archive.extract(source, stateTarget);
    const owner = file.recordId ? byId.get(file.recordId) : undefined;
    if (file.id === "art-invitation" || file.id === "art-save_the_date" ||
        owner?.kind === "invitation" || owner?.kind === "save_the_date") {
      const kind = file.id === "art-invitation" || owner?.kind === "invitation" ? "invitation" : "saveTheDate";
      const prior = database.prepare(`SELECT ${kind}FilePath AS storagePath, ${kind}FileName AS fileName,
        ${kind}FileMime AS mimeType FROM EventSettings WHERE id = 'singleton'`).get() as
        { storagePath: string | null; fileName: string | null; mimeType: string | null } | undefined;
      if (prior?.storagePath) {
        const existing = path.join(uploads, prior.storagePath);
        if (existsSync(existing) && (await sha256File(existing)).sha256 === file.sha256 &&
            prior.fileName === file.fileName && prior.mimeType === file.mimeType) continue;
      }
      const relative = `portable/${file.id}/${file.sha256}`;
      const target = path.join(uploads, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(stateTarget, target);
      database.prepare(`UPDATE EventSettings SET ${kind}FilePath = ?, ${kind}FileName = ?, ${kind}FileMime = ? WHERE id = 'singleton'`)
        .run(relative, file.fileName, file.mimeType);
      continue;
    }
    const prior = database.prepare("SELECT id, sha256Full, storagePath, filename, mimeType, size, deletedAt FROM Attachment WHERE id = ?").get(file.id) as
      { id: string; sha256Full: string | null; storagePath: string; filename: string;
        mimeType: string; size: number; deletedAt: number | null } | undefined;
    if (prior && existsSync(path.join(uploads, prior.storagePath)) &&
        (await sha256File(path.join(uploads, prior.storagePath))).sha256 === file.sha256) {
      if (prior.filename === file.fileName && prior.mimeType === file.mimeType &&
          prior.size === file.byteSize && sqlDate(file.deletedAt) === prior.deletedAt) continue;
      database.prepare("UPDATE Attachment SET filename = ?, mimeType = ?, size = ?, deletedAt = ? WHERE id = ?")
        .run(file.fileName, file.mimeType, file.byteSize, sqlDate(file.deletedAt), file.id);
      continue;
    }
    if (!owner || !["vendor", "contract", "venue"].includes(owner.kind)) continue;
    const relative = `portable/${file.id}/${file.sha256}`;
    const target = path.join(uploads, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(stateTarget, target);
    if (prior) {
      database.prepare("UPDATE Attachment SET filename = ?, mimeType = ?, size = ?, sha256Full = ?, storagePath = ?, deletedAt = ? WHERE id = ?")
        .run(file.fileName, file.mimeType, file.byteSize, file.sha256, relative, sqlDate(file.deletedAt), file.id);
    } else {
      const type = owner.kind.toUpperCase();
      database.prepare(`INSERT INTO Attachment
        (id, ownerType, ownerId, vendorId, contractId, venueId, kind, filename, mimeType, size,
         storagePath, sha256Full, version, uploadedById, createdAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`)
        .run(file.id, type, owner.id, owner.kind === "vendor" ? owner.id : null,
          owner.kind === "contract" ? owner.id : null, owner.kind === "venue" ? owner.id : null,
          file.kind, file.fileName, file.mimeType, file.byteSize, relative, file.sha256,
          sqlDate(file.createdAt), sqlDate(file.deletedAt));
    }
  }
}

function applySettings(database: DatabaseSync, settings: SettingsRow[], preview: PortablePreview): void {
  const allowed = new Set(["eventDate", "contingencyPercent", "currency", "coupleNames", "rainPlanB",
    "daySchedule", "daySpecialNotes", "defaultLocale", "pixKey", "pixKeyType", "pixHolderName",
    "pixCity", "weddingWebsiteUrl", "giftRegistryUrl", "saveTheDateMessage", "invitationMessage"]);
  const valid = database.prepare("PRAGMA table_info(EventSettings)").all() as { name: string }[];
  const columns = new Set(valid.map((row) => row.name));
  for (const setting of settings) {
    if (!allowed.has(setting.key) || !columns.has(setting.key)) continue;
    const existing = database.prepare(`SELECT "${setting.key}" AS value FROM EventSettings WHERE id = 'singleton'`).get() as
      { value: string | number | null } | undefined;
    const previous = setting.key === "eventDate" && typeof existing?.value === "number"
      ? new Date(existing.value).toISOString().slice(0, 10)
      : String(existing?.value ?? "");
    if (previous === setting.value) continue;
    const value = setting.key === "eventDate" ? (setting.value ? Date.parse(`${setting.value}T00:00:00.000Z`) : null) : setting.value;
    database.prepare(`UPDATE EventSettings SET "${setting.key}" = ? WHERE id = 'singleton'`).run(value);
  }
  const event = database.prepare("SELECT currency, defaultLocale FROM EventSettings WHERE id = 'singleton'").get() as
    { currency: string; defaultLocale: string } | undefined;
  if (event && (event.currency !== preview.manifest.currency || event.defaultLocale !== preview.manifest.locale)) {
    database.prepare("UPDATE EventSettings SET currency = ?, defaultLocale = ? WHERE id = 'singleton'")
      .run(preview.manifest.currency, preview.manifest.locale);
  }
}

function applyAudit(database: DatabaseSync, audits: AuditRow[]): void {
  const insert = database.prepare("INSERT INTO AuditLog (id, entity, entityId, action, payload, userId, createdAt) VALUES (?, ?, ?, ?, ?, NULL, ?)");
  const exists = database.prepare("SELECT id FROM AuditLog WHERE id = ?");
  for (const item of audits) {
    if (!safeId(item.id) || item.id.startsWith("broadcast-") || exists.get(item.id)) continue;
    insert.run(item.id, "Android", item.recordId ?? item.id, item.action, item.details, sqlDate(item.at));
  }
}

function applyTemplates(database: DatabaseSync, records: InspectedPortable["records"], baseline: InspectedPortable["baseline"]): void {
  const initial = new Map(baseline.map((record) => [record.id, record]));
  for (const record of records) {
    const column = record.kind === "invitation" ? "invitationMessage" :
      record.kind === "save_the_date" ? "saveTheDateMessage" : null;
    if (!column || initial.get(record.id)?.notes === record.notes) continue;
    database.prepare(`UPDATE EventSettings SET ${column} = ? WHERE id = 'singleton'`).run(record.notes || null);
  }
}

async function stage(result: InspectedPortable, target: string): Promise<{ database: string; uploads: string; state: string }> {
  const stagedDb = path.join(target, "web.sqlite");
  const stagedUploads = path.join(target, "uploads");
  const stagedState = path.join(target, "android-state");
  if (result.preview.manifest.webDatabase) await result.archive.extract("web.sqlite", stagedDb);
  else await snapshot(databasePath(), stagedDb);
  await fs.mkdir(stagedUploads, { recursive: true });
  for (const relative of Object.keys(result.preview.manifest.uploads)) {
    await result.archive.extract(`uploads/${relative}`, path.join(stagedUploads, relative));
  }
  const db = new DatabaseSync(stagedDb);
  try {
    if (!result.preview.manifest.webDatabase) prepareAndroidBase(db);
    mergeMobileRecords(db, result.records, result.baseline);
    await applyFiles(result, db, stagedUploads, stagedState);
    applySettings(db, await result.archive.readJson<SettingsRow[]>("settings.json"), result.preview);
    applyTemplates(db, result.records, result.baseline);
    applyAudit(db, await result.archive.readJson<AuditRow[]>("audit.json"));
    db.exec(`CREATE TABLE IF NOT EXISTS PortableState (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updatedAt DATETIME NOT NULL)`);
    const data = JSON.stringify({ records: result.records, files: result.files,
      settings: await result.archive.readJson<SettingsRow[]>("settings.json"),
      audits: await result.archive.readJson<AuditRow[]>("audit.json"),
      lineageId: result.preview.manifest.lineageId, generation: result.preview.manifest.generation });
    db.prepare("INSERT OR REPLACE INTO PortableState (key, value, updatedAt) VALUES ('androidTransfer', ?, ?)")
      .run(data, Date.now());
    if (db.prepare("PRAGMA foreign_key_check").get() || db.prepare("PRAGMA quick_check").get()?.quick_check !== "ok") {
      throw new Error("Banco convertido inválido");
    }
  } finally { db.close(); }
  return { database: stagedDb, uploads: stagedUploads, state: stagedState };
}

async function snapshot(source: string, target: string): Promise<void> {
  const db = new DatabaseSync(source, { readOnly: true });
  try { await backup(db, target); } finally { db.close(); }
}

export async function restorePortable(source: string, password: string): Promise<PortablePreview> {
  return inspectPortable(source, password, async (result) => {
    if (result.preview.blockers.length) throw new Error(result.preview.blockers.join("; "));
    const temporary = await fs.mkdtemp(path.join(tmpdir(), "wfp-restore-"));
    try {
      const staged = await stage(result, temporary);
      const stats = await fs.statfs(process.cwd());
      const available = stats.bavail * stats.bsize;
      if (available < result.preview.requiredBytes * 2 + 20_000_000) throw new Error("Espaço insuficiente para reversão");
      const release = await acquirePortableOperation();
      const reversal = path.join(process.cwd(), ".portable-reversions", `${Date.now()}-${randomUUID()}`);
      const stateRoot = path.join(process.cwd(), ".portable-state");
      let journal = false;
      try {
        await fs.mkdir(reversal, { recursive: true });
        await snapshot(databasePath(), path.join(reversal, "web.sqlite"));
        const currentUploads = path.join(process.cwd(), "uploads");
        if (existsSync(currentUploads)) await fs.cp(currentUploads, path.join(reversal, "uploads"), { recursive: true });
        if (existsSync(stateRoot)) await fs.cp(stateRoot, path.join(reversal, "android-state"), { recursive: true });
        await writeRestoreJournal(reversal, "prepared");
        journal = true;
        await fs.rm(currentUploads, { recursive: true, force: true });
        await fs.cp(staged.uploads, currentUploads, { recursive: true });
        await writeRestoreJournal(reversal, "files");
        await snapshot(staged.database, databasePath());
        await writeRestoreJournal(reversal, "database");
        await fs.rm(stateRoot, { recursive: true, force: true });
        await fs.cp(staged.state, stateRoot, { recursive: true, force: true });
        await clearRestoreJournal();
      } catch (error) {
        if (journal) {
          await snapshot(path.join(reversal, "web.sqlite"), databasePath());
          await fs.rm(path.join(process.cwd(), "uploads"), { recursive: true, force: true });
          if (existsSync(path.join(reversal, "uploads"))) {
            await fs.cp(path.join(reversal, "uploads"), path.join(process.cwd(), "uploads"), { recursive: true });
          }
          await fs.rm(stateRoot, { recursive: true, force: true });
          if (existsSync(path.join(reversal, "android-state"))) {
            await fs.cp(path.join(reversal, "android-state"), stateRoot, { recursive: true });
          }
          await clearRestoreJournal();
        }
        throw error;
      } finally { await release(); }
      return result.preview;
    } finally { await fs.rm(temporary, { recursive: true, force: true }); }
  });
}

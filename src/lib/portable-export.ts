import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { projectWeb, readWebTables } from "./portable-projection";
import type { MobileRecord } from "./portable-projection";
import { sha256File, sqliteSchemaHash, writePortableFile, type PortableEntry, type PortableManifest } from "./portable-format";

export function preserveAndroidFields(projected: MobileRecord, prior: MobileRecord): MobileRecord {
  const webExtra = JSON.parse(projected.extraJson) as Record<string, unknown>;
  const androidExtra = JSON.parse(prior.extraJson) as Record<string, unknown>;
  const result = { ...prior, extraJson: JSON.stringify({ ...androidExtra, ...webExtra }) };
  const shared = new Set<keyof MobileRecord>();
  if (projected.kind === "invitation" || projected.kind === "save_the_date") {
    shared.add("notes");
  } else {
    shared.add("title");
    shared.add("createdAt");
    shared.add("updatedAt");
    if (Object.hasOwn(webExtra, "deletedAt")) shared.add("deletedAt");
    if (["vendor", "venue", "budget", "payment", "income", "asset", "goal", "gift",
      "honeymoon", "honeymoon_item", "trousseau", "table", "contract"].includes(projected.kind)) shared.add("amountCents");
    if (["budget", "trousseau"].includes(projected.kind)) shared.add("estimatedCents");
    if (["venue", "payment", "income", "asset", "goal", "task", "gift", "honeymoon",
      "honeymoon_item", "contract"].includes(projected.kind)) shared.add("date");
    if (["vendor", "payment", "income", "task", "guest", "gift", "honeymoon_item",
      "trousseau", "contract", "vendor_note", "venue_check"].includes(projected.kind)) shared.add("status");
    if (["budget", "payment", "asset", "task", "gift", "honeymoon_item", "contract",
      "contact", "vendor_note", "venue_check"].includes(projected.kind)) shared.add("parentId");
    if (["vendor", "income"].includes(projected.kind)) shared.add("subtitle");
    if (["guest", "contact", "group", "venue"].includes(projected.kind)) shared.add("phone");
    if (["guest", "contact", "group"].includes(projected.kind)) shared.add("email");
    if (Object.hasOwn(webExtra, "notes")) shared.add("notes");
    if (projected.kind === "guest") {
      for (const field of ["guestGroupId", "seatingTableId", "plusOnesAllowed", "plusOnesConfirmed"] as const) shared.add(field);
    }
  }
  for (const key of shared) (result as unknown as Record<string, unknown>)[key] = projected[key];
  return result;
}

export function databasePath(): string {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) throw new Error("DATABASE_URL deve apontar para SQLite local");
  const name = decodeURIComponent(url.slice(5).split("?")[0]);
  return path.resolve(path.isAbsolute(name) ? "/" : path.join(process.cwd(), "prisma"), name);
}

async function inventoryUploads(root: string): Promise<{ entries: PortableEntry[]; hashes: PortableManifest["uploads"] }> {
  const entries: PortableEntry[] = [];
  const hashes: PortableManifest["uploads"] = {};
  async function walk(directory: string): Promise<void> {
    for (const child of await fs.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, child.name);
      const stat = await fs.lstat(full);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
        throw new Error(`Entrada insegura em uploads/: ${full}`);
      }
      if (stat.isDirectory()) await walk(full);
      else {
        const relative = path.relative(root, full).split(path.sep).join("/");
        hashes[relative] = await sha256File(full);
        entries.push({ name: `uploads/${relative}`, file: full });
      }
    }
  }
  await fs.mkdir(root, { recursive: true });
  await walk(root);
  return { entries, hashes };
}

export async function exportPortable(password: string): Promise<{ file: string; manifest: PortableManifest; dispose(): Promise<void> }> {
  const temporary = await fs.mkdtemp(path.join(tmpdir(), "wfp-export-"));
  const output = path.join(temporary, "backup.wfpbackup");
  try {
    const source = new DatabaseSync(databasePath(), { readOnly: true });
    const snapshot = path.join(temporary, "web.sqlite");
    try {
      await backup(source, snapshot);
    } finally {
      source.close();
    }
    const database = new DatabaseSync(snapshot, { readOnly: true });
    let projected: Awaited<ReturnType<typeof projectWeb>>;
    let webTables: Record<string, number>;
    let schemaHash: string;
    let event: Record<string, string | number | bigint | null> | undefined;
    let saved: {
      records?: typeof projected.records; files?: typeof projected.files;
      settings?: typeof projected.settings; audits?: typeof projected.audits;
      lineageId?: string; generation?: number;
    } | null = null;
    try {
      if (database.prepare("PRAGMA quick_check").get()?.quick_check !== "ok" ||
          database.prepare("PRAGMA foreign_key_check").get()) throw new Error("Snapshot SQLite inválido");
      const data = readWebTables(database);
      webTables = data.counts;
      schemaHash = sqliteSchemaHash(database);
      event = data.tables.EventSettings?.[0];
      projected = await projectWeb(data.tables, path.join(process.cwd(), "uploads"));
      const value = data.tables.PortableState?.find((row) => row.key === "androidTransfer")?.value;
      if (typeof value === "string") saved = JSON.parse(value);
    } finally {
      database.close();
    }
    const uploads = await inventoryUploads(path.join(process.cwd(), "uploads"));
    const webDatabase = await sha256File(snapshot);
    if (saved) {
      const projectedIds = new Set(projected.records.map((record) => record.id));
      const oldRecords = new Map((saved.records ?? []).map((record) => [record.id, record]));
      projected.records = projected.records.map((record) => {
        const prior = oldRecords.get(record.id);
        if (!prior) return record;
        return preserveAndroidFields(record, prior);
      });
      projected.records.push(...(saved.records ?? []).filter((record) => !projectedIds.has(record.id)));
      const projectedFiles = new Set(projected.files.map((file) => file.id));
      for (const file of saved.files ?? []) {
        if (projectedFiles.has(file.id)) continue;
        const stored = path.join(process.cwd(), ".portable-state", "blobs", file.id);
        const actual = await sha256File(stored);
        if (actual.sha256 !== file.sha256 || actual.size !== file.byteSize) {
          throw new Error(`Arquivo Android preservado mudou: ${file.id}`);
        }
        projected.files.push(file);
        projected.blobEntries.push({ name: `blobs/${file.id}`, file: stored });
      }
      const settings = new Set(projected.settings.map((item) => item.key));
      projected.settings.push(...(saved.settings ?? []).filter((item) => !settings.has(item.key)));
      const audits = new Set(projected.audits.map((item) => item.id));
      projected.audits.push(...(saved.audits ?? []).filter((item) => !audits.has(item.id)));
    }
    const manifest: PortableManifest = {
      format: "wfp-portable", version: 2, origin: "web", lineageId: saved?.lineageId ?? randomUUID(),
      generation: (saved?.generation ?? 0) + 1,
      exportedAt: Date.now(), records: projected.records.length, files: projected.files.length,
      hashes: Object.fromEntries(projected.files.map((file) => [file.id, file.sha256])),
      locale: String(event?.defaultLocale ?? "pt-BR"), currency: String(event?.currency ?? "BRL"),
      webTables, schemas: { web: schemaHash, android: 2 }, uploads: uploads.hashes, webDatabase,
    };
    const json = (name: string, value: unknown): PortableEntry => ({ name, bytes: Buffer.from(JSON.stringify(value)) });
    await writePortableFile(output, password, [
      json("manifest.json", manifest),
      json("records.json", projected.records),
      json("baseline.json", projected.records),
      json("files.json", projected.files),
      json("settings.json", projected.settings),
      json("audit.json", projected.audits),
      { name: "web.sqlite", file: snapshot },
      ...projected.blobEntries,
      ...uploads.entries,
    ]);
    for (const [relative, expected] of Object.entries(uploads.hashes)) {
      const actual = await sha256File(path.join(process.cwd(), "uploads", relative));
      if (actual.sha256 !== expected.sha256 || actual.size !== expected.size) {
        throw new Error(`uploads/ mudou durante a exportação: ${relative}`);
      }
    }
    const { inspectPortable } = await import("./portable-inspect");
    const verified = await inspectPortable(output, password, async ({ preview }) => preview);
    if (verified.blockers.length || verified.manifest.records !== manifest.records ||
        verified.manifest.files !== manifest.files) {
      throw new Error(`Backup gerado não passou na verificação: ${verified.blockers.join("; ")}`);
    }
    return { file: output, manifest, dispose: () => fs.rm(temporary, { recursive: true, force: true }) };
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

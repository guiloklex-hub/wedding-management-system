import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { sha256File, type PortableEntry } from "./portable-format";

export type Row = Record<string, string | number | bigint | null>;
type Mapping = { kind: string; title: string; amount?: string; status?: string; date?: string; parent?: string };

const mapping: Record<string, Mapping> = {
  Vendor: { kind: "vendor", title: "name", status: "status" },
  Venue: { kind: "venue", title: "name", amount: "baseRate", date: "visitedAt" },
  BudgetItem: { kind: "budget", title: "title", amount: "actualValue", parent: "vendorId" },
  Payment: { kind: "payment", title: "notes", amount: "amount", status: "status", date: "dueDate", parent: "vendorId" },
  Income: { kind: "income", title: "title", amount: "amount", status: "status", date: "expectedDate" },
  Asset: { kind: "asset", title: "title", amount: "amount", date: "date", parent: "goalId" },
  SavingsGoal: { kind: "goal", title: "name", amount: "targetAmount", date: "targetDate" },
  Task: { kind: "task", title: "title", status: "status", date: "deadline", parent: "vendorId" },
  Guest: { kind: "guest", title: "name", status: "rsvpStatus" },
  GuestGroup: { kind: "group", title: "name" },
  GuestTag: { kind: "tag", title: "name" },
  Gift: { kind: "gift", title: "description", amount: "amount", status: "status", date: "receivedAt", parent: "guestId" },
  Honeymoon: { kind: "honeymoon", title: "destination", amount: "budget", date: "startDate" },
  HoneymoonItem: { kind: "honeymoon_item", title: "title", amount: "amount", status: "status", date: "startAt", parent: "honeymoonId" },
  TrousseauItem: { kind: "trousseau", title: "title", amount: "actualPrice", status: "status" },
  SeatingTable: { kind: "table", title: "name", amount: "capacity" },
  Contract: { kind: "contract", title: "title", amount: "totalValue", status: "status", date: "signedAt", parent: "vendorId" },
  VendorContact: { kind: "contact", title: "name", parent: "vendorId" },
  VendorNote: { kind: "vendor_note", title: "body", status: "kind", parent: "vendorId" },
  VenueChecklistItem: { kind: "venue_check", title: "label", parent: "venueId" },
};

const hiddenFields = new Set(["password", "twoFactorSecret", "twoFactorBackupCodes", "rsvpToken", "rsvpPin",
  "tokenHash", "uploadedById", "userId", "invitationRsvpUrl"]);

export type MobileRecord = {
  id: string; kind: string; title: string; subtitle: string; amountCents: number | null;
  estimatedCents: number | null; date: string | null; status: string; parentId: string | null;
  guestGroupId: string | null; seatingTableId: string | null; plusOnesAllowed: number;
  plusOnesConfirmed: number; phone: string; email: string; notes: string; extraJson: string;
  createdAt: number; updatedAt: number; deletedAt: number | null;
};

export type MobileFile = {
  id: string; recordId: string | null; kind: string; fileName: string; mimeType: string;
  byteSize: number; sha256: string; createdAt: number; deletedAt: number | null; version?: number;
};

function optionalString(value: Row[string] | undefined): string {
  return value == null ? "" : String(value);
}

export function attachmentOwner(row: Row): string | null {
  const ownerType = optionalString(row.ownerType).toUpperCase();
  const preferred = ownerType === "CONTRACT" ? row.contractId ?? row.ownerId :
    ownerType === "VENDOR" ? row.vendorId ?? row.ownerId :
      ownerType === "VENUE" ? row.venueId ?? row.ownerId : null;
  return optionalString(preferred ?? row.contractId ?? row.vendorId ?? row.venueId ?? row.ownerId) || null;
}

export function assertWebContractCoverage(
  contracts: Row[], attachments: Row[], records: MobileRecord[], files: MobileFile[],
  uploads: Record<string, { sha256: string; size: number }>,
): void {
  const recordsById = new Map(records.map((item) => [item.id, item]));
  const filesById = new Map(files.map((item) => [item.id, item]));
  for (const contract of contracts) {
    const id = optionalString(contract.id);
    const projected = recordsById.get(id);
    if (projected?.kind !== "contract") {
      throw new Error(`Contrato ausente no Android: ${id}`);
    }
  }
  for (const attachment of attachments) {
    const id = optionalString(attachment.id);
    const projected = filesById.get(id);
    const owner = attachmentOwner(attachment);
    if (!projected || projected.recordId !== owner) {
      throw new Error(`Anexo ausente ou sem dono no Android: ${id}`);
    }
    const stored = optionalString(attachment.storagePath);
    const relative = stored.startsWith("uploads/") ? stored.slice(8) : stored;
    const uploaded = uploads[relative];
    if (!uploaded || projected.sha256 !== uploaded.sha256 || projected.byteSize !== uploaded.size) {
      throw new Error(`PDF ou anexo divergente no Android: ${id}`);
    }
    if (projected.version != null && attachment.version != null &&
        projected.version !== Number(attachment.version)) {
      throw new Error(`Versão do anexo divergente no Android: ${id}`);
    }
  }
}

export function milliseconds(value: Row[string] | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" || typeof value === "bigint") {
    const number = Number(value);
    return Math.abs(number) > 100_000_000_000 ? number : number * 1000;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`Data inválida: ${value}`);
  return parsed;
}

function calendarDay(value: Row[string] | undefined): string | null {
  const date = milliseconds(value);
  return date == null ? null : new Date(date).toISOString().slice(0, 10);
}

function cents(value: Row[string] | undefined): number | null {
  if (value == null) return null;
  const number = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(number)) throw new Error("Valor monetário inválido");
  return number;
}

function record(id: string, kind: string, title: string, now: number): MobileRecord {
  return { id, kind, title, subtitle: "", amountCents: null, estimatedCents: null, date: null,
    status: "", parentId: null, guestGroupId: null, seatingTableId: null, plusOnesAllowed: 0,
    plusOnesConfirmed: 0, phone: "", email: "", notes: "", extraJson: "{}",
    createdAt: now, updatedAt: now, deletedAt: null };
}

function rowTable(database: DatabaseSync, name: string): Row[] {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Tabela inválida: ${name}`);
  return database.prepare(`SELECT * FROM "${name}"`).all() as Row[];
}

export function readWebTables(database: DatabaseSync): { tables: Record<string, Row[]>; counts: Record<string, number> } {
  const names = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  const tables: Record<string, Row[]> = {};
  const counts: Record<string, number> = {};
  for (const { name } of names) {
    tables[name] = rowTable(database, name);
    counts[name] = tables[name].length;
  }
  return { tables, counts };
}

function safeUpload(root: string, storagePath: string): string {
  const relative = storagePath.startsWith("uploads/") ? storagePath.slice(8) : storagePath;
  if (!relative || relative.startsWith("/") || relative.includes("\\") ||
      relative.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Caminho de anexo inválido: ${storagePath}`);
  }
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error("Anexo fora de uploads/");
  return resolved;
}

export async function projectWeb(tables: Record<string, Row[]>, uploadsRoot: string): Promise<{
  records: MobileRecord[]; files: MobileFile[]; settings: { key: string; value: string }[];
  audits: { id: string; recordId: null; action: string; at: number; details: string }[];
  blobEntries: PortableEntry[];
}> {
  const now = Date.now();
  const records: MobileRecord[] = [];
  for (const [table, spec] of Object.entries(mapping)) {
    for (const row of tables[table] ?? []) {
      const id = optionalString(row.id);
      const item = record(id, spec.kind, optionalString(row[spec.title]) ||
        (spec.kind === "payment" ? `Pagamento ${id}` : spec.kind), now);
      item.subtitle = optionalString(row.category ?? row.source);
      item.amountCents = spec.kind === "table" ? Number(row.capacity ?? 0) : cents(spec.amount ? row[spec.amount] : null);
      item.estimatedCents = cents(spec.kind === "budget" ? row.estimatedValue :
        spec.kind === "trousseau" ? row.estimatedPrice : null);
      item.date = calendarDay(spec.kind === "income" ? row.receivedAt ?? row.expectedDate :
        spec.date ? row[spec.date] : null);
      item.status = spec.status ? optionalString(row[spec.status]) :
        spec.kind === "venue_check" ? (row.checked ? "DONE" : "TODO") : "";
      item.parentId = spec.parent ? optionalString(row[spec.parent]) || null : null;
      item.guestGroupId = spec.kind === "guest" ? optionalString(row.groupId) || null : null;
      item.seatingTableId = spec.kind === "guest" ? optionalString(row.tableId) || null : null;
      item.plusOnesAllowed = spec.kind === "guest" ? Number(row.plusOnesAllowed ?? 0) : 0;
      item.plusOnesConfirmed = spec.kind === "guest" ? Number(row.plusOnesConfirmed ?? 0) : 0;
      item.phone = optionalString(row.phone ?? row.contactPhone);
      item.email = optionalString(row.email ?? row.contactEmail);
      item.notes = optionalString(row.notes ?? row.description);
      item.createdAt = milliseconds(row.createdAt) ?? now;
      item.updatedAt = milliseconds(row.updatedAt) ?? now;
      item.deletedAt = milliseconds(row.deletedAt);
      item.extraJson = JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) =>
        key !== "id" && !hiddenFields.has(key))));
      records.push(item);
    }
  }
  const tagsByGuest = new Map<string, string[]>();
  for (const link of tables.GuestTagOnGuest ?? []) {
    const guestId = optionalString(link.guestId);
    tagsByGuest.set(guestId, [...(tagsByGuest.get(guestId) ?? []), optionalString(link.tagId)]);
  }
  for (const item of records) {
    if (item.kind === "guest" && tagsByGuest.has(item.id)) {
      item.extraJson = JSON.stringify({ ...JSON.parse(item.extraJson), tagIds: tagsByGuest.get(item.id) });
    }
  }
  const event = tables.EventSettings?.[0] ?? {};
  const settings = Object.entries(event).filter(([key, value]) => key !== "id" && !hiddenFields.has(key) &&
    !["aiEnabled", "rsvpReminderEnabled", "rsvpReminderDays"].includes(key) && value != null)
    .map(([key, value]) => ({ key, value: key === "eventDate" ? calendarDay(value) ?? "" : String(value) }));
  for (const [kind, messageKey, fileKey] of [
    ["invitation", "invitationMessage", "invitationFilePath"],
    ["save_the_date", "saveTheDateMessage", "saveTheDateFilePath"],
  ]) {
    if (event[messageKey] || event[fileKey]) {
      const item = record(`web-${kind}-template`, kind, kind === "invitation" ? "Convite" : "Save the Date", now);
      item.notes = optionalString(event[messageKey]);
      item.status = "DRAFT";
      records.push(item);
    }
  }
  const ids = new Set(records.map((item) => item.id));
  if (ids.size !== records.length) throw new Error("IDs web repetidos");
  for (const item of records) {
    for (const key of ["parentId", "guestGroupId", "seatingTableId"] as const) {
      if (item[key] && !ids.has(item[key])) throw new Error(`Relação inválida: ${item.id}.${key}`);
    }
  }
  const files: MobileFile[] = [];
  const blobEntries: PortableEntry[] = [];
  for (const row of tables.Attachment ?? []) {
    const id = optionalString(row.id);
    const owner = attachmentOwner(row);
    if (owner && !ids.has(owner)) throw new Error(`Anexo sem dono: ${id}`);
    const file = safeUpload(uploadsRoot, optionalString(row.storagePath));
    const { sha256: hash, size } = await sha256File(file);
    if (row.sha256Full && row.sha256Full !== hash) throw new Error(`Hash divergente: ${id}`);
    if (row.size != null && Number(row.size) !== size) throw new Error(`Tamanho divergente: ${id}`);
    files.push({ id, recordId: owner, kind: optionalString(row.kind) || "OTHER",
      fileName: optionalString(row.filename) || path.basename(file),
      mimeType: optionalString(row.mimeType) || "application/octet-stream",
      byteSize: size, sha256: hash, createdAt: milliseconds(row.createdAt) ?? now,
      deletedAt: milliseconds(row.deletedAt), version: Number(row.version ?? 1) });
    blobEntries.push({ name: `blobs/${id}`, file });
  }
  for (const [kind, pathKey, nameKey, mimeKey] of [
    ["invitation", "invitationFilePath", "invitationFileName", "invitationFileMime"],
    ["save_the_date", "saveTheDateFilePath", "saveTheDateFileName", "saveTheDateFileMime"],
  ]) {
    if (!event[pathKey]) continue;
    const file = safeUpload(uploadsRoot, optionalString(event[pathKey]));
    const { sha256, size } = await sha256File(file);
    const id = `art-${kind}`;
    files.push({ id, recordId: `web-${kind}-template`, kind,
      fileName: optionalString(event[nameKey]) || path.basename(file),
      mimeType: optionalString(event[mimeKey]) || "application/octet-stream",
      byteSize: size, sha256,
      createdAt: now, deletedAt: null });
    blobEntries.push({ name: `blobs/${id}`, file });
  }
  const audits = (tables.AuditLog ?? []).map((row) => ({ id: optionalString(row.id), recordId: null,
    action: optionalString(row.action) || "WEB", at: milliseconds(row.createdAt) ?? now,
    details: optionalString(row.payload) }));
  for (const row of tables.BroadcastRecipient ?? []) {
    audits.push({ id: `broadcast-${row.id}`, recordId: null,
      action: `INVITE_${optionalString(row.status) || "UNKNOWN"}`,
      at: milliseconds(row.sentAt ?? row.createdAt) ?? now,
      details: JSON.stringify({ name: row.name, channel: row.channelUsed }) });
  }
  return { records, files, settings, audits, blobEntries };
}

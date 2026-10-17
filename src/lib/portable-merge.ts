import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { webExtraColumns, webIncomeSource, type SqlValue } from "./portable-fields";
import type { MobileRecord } from "./portable-projection";

type FieldMap = { table: string; title: string; amount?: string; estimate?: string; date?: string; status?: string; parent?: string };

const fields: Record<string, FieldMap> = {
  vendor: { table: "Vendor", title: "name", status: "status" },
  venue: { table: "Venue", title: "name", amount: "baseRate", date: "visitedAt" },
  budget: { table: "BudgetItem", title: "title", amount: "actualValue", estimate: "estimatedValue", parent: "vendorId" },
  payment: { table: "Payment", title: "notes", amount: "amount", date: "dueDate", status: "status", parent: "vendorId" },
  income: { table: "Income", title: "title", amount: "amount", date: "expectedDate", status: "status" },
  asset: { table: "Asset", title: "title", amount: "amount", date: "date", parent: "goalId" },
  goal: { table: "SavingsGoal", title: "name", amount: "targetAmount", date: "targetDate" },
  task: { table: "Task", title: "title", date: "deadline", status: "status", parent: "vendorId" },
  guest: { table: "Guest", title: "name", status: "rsvpStatus" },
  group: { table: "GuestGroup", title: "name" },
  tag: { table: "GuestTag", title: "name" },
  gift: { table: "Gift", title: "description", amount: "amount", date: "receivedAt", status: "status", parent: "guestId" },
  honeymoon: { table: "Honeymoon", title: "destination", amount: "budget", date: "startDate" },
  honeymoon_item: { table: "HoneymoonItem", title: "title", amount: "amount", date: "startAt", status: "status", parent: "honeymoonId" },
  trousseau: { table: "TrousseauItem", title: "title", amount: "actualPrice", estimate: "estimatedPrice", status: "status" },
  table: { table: "SeatingTable", title: "name", amount: "capacity" },
  contract: { table: "Contract", title: "title", amount: "totalValue", date: "signedAt", status: "status", parent: "vendorId" },
  contact: { table: "VendorContact", title: "name", parent: "vendorId" },
  vendor_note: { table: "VendorNote", title: "body", status: "kind", parent: "vendorId" },
  venue_check: { table: "VenueChecklistItem", title: "label", parent: "venueId" },
};

const TRACKED_TABLES = [...new Set([...Object.values(fields).map((map) => map.table),
  "Attachment", "EventSettings", "GuestTagOnGuest"])];

function tableRows(database: DatabaseSync | null, table: string): Map<string, string> {
  const rows = new Map<string, string>();
  if (!database || !database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) {
    return rows;
  }
  for (const row of database.prepare(`SELECT * FROM "${table}"`).all() as Record<string, SqlValue>[]) {
    const serialized = JSON.stringify(row, (_key, value) => typeof value === "bigint" ? value.toString() : value);
    rows.set(row.id == null ? serialized : String(row.id), serialized);
  }
  return rows;
}

/**
 * Conta linhas do banco web atual que diferem da cópia que será usada como
 * base da restauração. Essas linhas seriam substituídas sem aviso.
 */
export function countWebDrift(snapshot: DatabaseSync | null, live: DatabaseSync): number {
  let drift = 0;
  for (const table of TRACKED_TABLES) {
    const before = tableRows(snapshot, table);
    const now = tableRows(live, table);
    for (const [id, row] of now) if (before.get(id) !== row) drift++;
    for (const id of before.keys()) if (!now.has(id)) drift++;
  }
  return drift;
}

function date(value: string | number | null): number | null {
  if (value == null || value === "") return null;
  return typeof value === "number" ? value : Date.parse(`${value}T00:00:00.000Z`);
}

function valueFor(key: keyof MobileRecord, value: MobileRecord[keyof MobileRecord], map: FieldMap): SqlValue {
  if (key === "amountCents") return value == null ? null : map.table === "SeatingTable" ? Number(value) : Number(value) / 100;
  if (key === "estimatedCents") return value == null ? null : Number(value) / 100;
  if (key === "date") return date(value as string | null);
  if (key === "createdAt" || key === "updatedAt" || key === "deletedAt") return date(value as number | null);
  return value as SqlValue;
}

function columnMap(record: MobileRecord, map: FieldMap): Record<string, SqlValue> {
  const columns: Record<string, SqlValue> = { [map.title]: record.title };
  for (const [key, column] of [
    ["amountCents", map.amount], ["estimatedCents", map.estimate], ["date", map.date],
    ["status", map.status], ["parentId", map.parent], ["createdAt", "createdAt"],
    ["updatedAt", "updatedAt"], ["deletedAt", "deletedAt"],
  ] as [keyof MobileRecord, string | undefined][]) {
    if (column) columns[column] = valueFor(key, record[key], map);
  }
  if (record.kind === "guest") Object.assign(columns, {
    groupId: record.guestGroupId, tableId: record.seatingTableId,
    plusOnesAllowed: record.plusOnesAllowed, plusOnesConfirmed: record.plusOnesConfirmed,
    phone: record.phone || null, email: record.email || null, notes: record.notes || null,
  });
  if (record.kind === "contact") Object.assign(columns, { phone: record.phone || null, email: record.email || null });
  if (record.kind === "group") Object.assign(columns, {
    contactPhone: record.phone || null, contactEmail: record.email || null,
  });
  if (record.kind === "venue") columns.contactPhone = record.phone || null;
  if (record.kind === "task") columns.description = record.notes || null;
  else if (record.kind === "payment") columns.notes = record.notes || record.title || null;
  else if (record.kind !== "vendor_note") columns.notes = record.notes || null;
  if (record.kind === "venue_check") columns.checked = record.status === "DONE" ? 1 : 0;
  if (record.kind === "vendor") columns.category = record.subtitle || "";
  if (record.kind === "income") columns.source = webIncomeSource(record.subtitle);
  return columns;
}

function extra(record: MobileRecord): Record<string, unknown> {
  const parsed: unknown = JSON.parse(record.extraJson || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Metadados inválidos: ${record.id}`);
  return parsed as Record<string, unknown>;
}

const SECRET_COLUMNS = new Set(["id", "password", "rsvpToken", "rsvpPin", "tokenHash", "twoFactorSecret",
  "twoFactorBackupCodes"]);

/** Colunas web fora de EXTRA_FIELDS (ex.: SeatingTable.x, Income.receivedAt) voltam como vieram. */
function rawSqlValue(value: unknown): SqlValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "bigint") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return undefined;
}

function paymentNotes(record: MobileRecord, prior: MobileRecord, previous: SqlValue): SqlValue {
  if (record.notes !== prior.notes) return record.notes || null;
  if (record.title !== prior.title) return record.title || null;
  return previous;
}

function extraDelta(record: MobileRecord, prior: MobileRecord): Record<string, SqlValue> {
  const next = webExtraColumns(record.kind, extra(record));
  const old = webExtraColumns(prior.kind, extra(prior));
  return Object.fromEntries(Object.entries(next).filter(([column, value]) =>
    JSON.stringify(value) !== JSON.stringify(old[column] ?? null)));
}

function columns(database: DatabaseSync, table: string): Map<string, { notnull: boolean; defaultValue: SqlValue }> {
  const rows = database.prepare(`PRAGMA table_info("${table}")`).all() as {
    name: string; notnull: number; dflt_value: SqlValue;
  }[];
  if (!rows.length) throw new Error(`Tabela ausente no web: ${table}`);
  return new Map(rows.map((row) => [row.name, { notnull: !!row.notnull, defaultValue: row.dflt_value }]));
}

function update(database: DatabaseSync, table: string, id: string, changes: Record<string, SqlValue>): void {
  const names = Object.keys(changes);
  if (!names.length) return;
  const quoted = names.map((name) => `"${name}" = ?`).join(", ");
  database.prepare(`UPDATE "${table}" SET ${quoted} WHERE id = ?`).run(...names.map((name) => changes[name]), id);
}

function applyGuestTags(database: DatabaseSync, record: MobileRecord, prior: MobileRecord | undefined): void {
  if (record.kind !== "guest") return;
  const tags = extra(record).tagIds;
  const previous = prior ? extra(prior).tagIds : undefined;
  if (JSON.stringify(tags) === JSON.stringify(previous)) return;
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) throw new Error(`Tags inválidas: ${record.id}`);
  const current = database.prepare("SELECT tagId FROM GuestTagOnGuest WHERE guestId = ?").all(record.id) as { tagId: string }[];
  const currentIds = new Set(current.map((item) => item.tagId));
  const nextIds = new Set(tags);
  for (const tagId of currentIds) if (!nextIds.has(tagId)) {
    database.prepare("DELETE FROM GuestTagOnGuest WHERE guestId = ? AND tagId = ?").run(record.id, tagId);
  }
  for (const tagId of nextIds) if (!currentIds.has(tagId)) {
    database.prepare("INSERT INTO GuestTagOnGuest (guestId, tagId, createdAt) VALUES (?, ?, ?)")
      .run(record.id, tagId, Date.now());
  }
}

export function prepareAndroidBase(database: DatabaseSync): void {
  const retained = new Set(["User", "PasswordResetToken", "SecuritySettings"]);
  const names = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  database.exec("PRAGMA foreign_keys = OFF");
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const { name } of names) {
      if (retained.has(name)) continue;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Tabela inválida no destino");
      database.exec(`DELETE FROM "${name}"`);
    }
    database.prepare("INSERT INTO EventSettings (id, updatedAt, onboardingCompletedAt) VALUES ('singleton', ?, ?)")
      .run(Date.now(), Date.now());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.exec("PRAGMA foreign_keys = ON");
  }
}

export type MergeOptions = {
  /** Aplica campos de `extraJson` em registros já existentes; exige backup Android com `fieldMap >= 1`. */
  applyExtras?: boolean;
};

function honeymoonFirst(records: MobileRecord[]): MobileRecord[] {
  return [...records.filter((record) => record.kind === "honeymoon"),
    ...records.filter((record) => record.kind !== "honeymoon")];
}

export function mergeMobileRecords(database: DatabaseSync, records: MobileRecord[], baseline: MobileRecord[],
  options: MergeOptions = {}): {
  changed: number; created: number; deleted: number; blockers: string[];
} {
  const current = honeymoonFirst(records);
  const remap = new Map<string, string>();
  let honeymoonMapped = false;
  const incomingGoals = new Set(records.filter((record) => record.kind === "goal" && record.deletedAt == null)
    .map((record) => record.id));
  const initial = new Map(baseline.map((record) => [record.id, record]));
  const incoming = new Map(current.map((record) => [record.id, record]));
  const blockers: string[] = [];
  let changed = 0;
  let created = 0;
  let deleted = 0;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec("PRAGMA defer_foreign_keys = ON");
    for (const prior of baseline) {
      if (incoming.has(prior.id)) continue;
      const map = fields[prior.kind];
      if (!map) continue;
      if (!columns(database, map.table).has("deletedAt")) {
        throw new Error(`${prior.kind} ${prior.id}: esta área não admite exclusão no web`);
      }
      database.prepare(`UPDATE "${map.table}" SET deletedAt = ? WHERE id = ?`)
        .run(Date.now(), prior.id);
      deleted++;
    }
    for (const original of current) {
      const map = fields[original.kind];
      if (!map) continue;
      const parentId = original.parentId ? remap.get(original.parentId) ?? original.parentId : null;
      let record = parentId === original.parentId ? original : { ...original, parentId };
      if (record.kind === "honeymoon" && record.id !== "singleton" && !initial.has(record.id)) {
        if (record.deletedAt != null || honeymoonMapped) continue;
        honeymoonMapped = true;
        remap.set(record.id, "singleton");
        const exists = initial.has("singleton") ||
          !!database.prepare("SELECT id FROM Honeymoon WHERE id = 'singleton'").get();
        record = { ...record, id: "singleton" };
        if (exists) {
          const schema = columns(database, map.table);
          update(database, map.table, "singleton", Object.fromEntries(Object.entries(columnMap(record, map))
            .filter(([column]) => schema.has(column) && column !== "createdAt")));
          changed++;
          continue;
        }
      }
      if (record.kind === "asset" && record.parentId && !incomingGoals.has(record.parentId) &&
          !database.prepare("SELECT id FROM SavingsGoal WHERE id = ?").get(record.parentId)) {
        record = { ...record, parentId: null };
      }
      const prior = initial.get(record.id);
      const schema = columns(database, map.table);
      const next = columnMap(record, map);
      const old = prior ? columnMap(prior, map) : {};
      if (record.kind === "payment" && prior) next.notes = paymentNotes(record, prior, old.notes ?? null);
      if (record.kind === "income" && prior && extra(prior).receivedAt) {
        next.receivedAt = next.expectedDate;
        old.receivedAt = old.expectedDate;
        delete next.expectedDate;
        delete old.expectedDate;
      }
      const nextExtra = webExtraColumns(record.kind, extra(record));
      if (prior) {
        const delta = Object.fromEntries(Object.entries(next).filter(([column, value]) =>
          schema.has(column) && JSON.stringify(value) !== JSON.stringify(old[column])));
        if (options.applyExtras) {
          for (const [column, value] of Object.entries(extraDelta(record, prior))) {
            if (schema.has(column) && !(column in next)) delta[column] = value;
          }
        }
        if (Object.keys(delta).length) {
          update(database, map.table, record.id, delta);
          changed++;
        }
        continue;
      }
      for (const [column, value] of Object.entries(nextExtra)) {
        if (schema.has(column) && !(column in next)) next[column] = value;
      }
      for (const [column, value] of Object.entries(extra(record))) {
        if (!schema.has(column) || column in next || SECRET_COLUMNS.has(column)) continue;
        const raw = rawSqlValue(value);
        if (raw !== undefined) next[column] = raw;
      }
      next.id = record.id;
      if (record.kind === "vendor" && !record.subtitle.trim()) {
        blockers.push(`vendor ${record.id}: falta category`);
        continue;
      }
      if (map.table === "Guest" || map.table === "GuestGroup") next.rsvpToken = randomUUID();
      if (map.table === "HoneymoonItem" && !next.honeymoonId) next.honeymoonId = "singleton";
      const missing = [...schema].filter(([name, info]) => name !== "id" && info.notnull &&
        info.defaultValue == null && (next[name] == null || next[name] === ""));
      if (missing.length) {
        blockers.push(`${record.kind} ${record.id}: faltam ${missing.map(([name]) => name).join(", ")}`);
        continue;
      }
      const names = Object.keys(next).filter((name) => schema.has(name));
      const placeholders = names.map(() => "?").join(", ");
      database.prepare(`INSERT INTO "${map.table}" (${names.map((name) => `"${name}"`).join(", ")}) VALUES (${placeholders})`)
        .run(...names.map((name) => next[name]));
      created++;
    }
    for (const record of current) applyGuestTags(database, record, initial.get(record.id));
    if (blockers.length) throw new Error(blockers.join("; "));
    const invalid = database.prepare("PRAGMA foreign_key_check").all();
    if (invalid.length) throw new Error("Relações web inválidas após conversão");
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { changed, created, deleted, blockers };
}

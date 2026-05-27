import { createHash } from "node:crypto";
import { z } from "zod";

export const BACKUP_VERSION = 3;
export const SUPPORTED_BACKUP_VERSIONS = [2, 3] as const;

const datetime = z.union([
  z.string(),
  z.date(),
  z.null(),
]);

const NullableString = z.string().nullable().optional();
const NullableBool = z.boolean().nullable().optional();

const Singleton = z
  .object({ id: z.string() })
  .passthrough()
  .nullable();

const RowsArray = z.array(z.object({ id: z.string() }).passthrough());

const Meta = z
  .object({
    appVersion: z.string().optional(),
    hostname: z.string().optional(),
    nodeVersion: z.string().optional(),
    schemaHash: z.string().optional(),
    exportedBy: z
      .object({ id: z.string(), email: z.string().nullable().optional() })
      .partial()
      .optional(),
  })
  .partial();

export const UserRow = z
  .object({
    id: z.string(),
    email: z.string(),
    name: NullableString,
    phone: NullableString,
    password: z.string(),
    role: z.string(),
    isActive: NullableBool,
    mustChangePassword: NullableBool,
    passwordUpdatedAt: datetime.optional(),
    lastLoginAt: datetime.optional(),
    archivedAt: datetime.optional(),
    twoFactorEnabled: NullableBool,
    twoFactorSecret: NullableString,
    twoFactorBackupCodes: NullableString,
    twoFactorUpdatedAt: datetime.optional(),
    locale: z.string().optional(),
    createdAt: datetime.optional(),
    updatedAt: datetime.optional(),
  })
  .passthrough();

export const BackupPayloadSchema = z
  .object({
    version: z.number().int(),
    exportedAt: z.string(),
    meta: Meta.optional(),
    eventSettings: Singleton,
    securitySettings: Singleton,
    users: z.array(UserRow).optional(),
    vendors: RowsArray,
    vendorContacts: RowsArray,
    vendorNotes: RowsArray,
    contracts: RowsArray,
    attachments: RowsArray,
    venues: RowsArray,
    venueChecklistItems: RowsArray,
    budgetItems: RowsArray,
    payments: RowsArray,
    incomes: RowsArray,
    assets: RowsArray,
    savingsGoals: RowsArray,
    honeymoon: Singleton,
    honeymoonItems: RowsArray,
    trousseauItems: RowsArray,
    guestGroups: RowsArray,
    guests: RowsArray,
    seatingTables: RowsArray,
    gifts: RowsArray,
    tasks: RowsArray,
    notificationLogs: RowsArray.optional(),
    auditLogs: RowsArray.optional(),
  })
  .passthrough();

export type BackupPayload = z.infer<typeof BackupPayloadSchema>;

export const BackupFileSchema = z.object({
  checksum: z
    .object({
      algorithm: z.literal("sha256"),
      value: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .optional(),
  payload: BackupPayloadSchema,
});

export type BackupFile = z.infer<typeof BackupFileSchema>;

export const ROW_COLLECTION_KEYS = [
  "vendors",
  "vendorContacts",
  "vendorNotes",
  "contracts",
  "attachments",
  "venues",
  "venueChecklistItems",
  "budgetItems",
  "payments",
  "incomes",
  "assets",
  "savingsGoals",
  "honeymoonItems",
  "trousseauItems",
  "guestGroups",
  "guests",
  "seatingTables",
  "gifts",
  "tasks",
  "users",
  "notificationLogs",
  "auditLogs",
] as const;

export const SINGLETON_KEYS = [
  "eventSettings",
  "securitySettings",
  "honeymoon",
] as const;

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
  );
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`)
    .join(",")}}`;
}

export function computeChecksum(payload: BackupPayload): string {
  return createHash("sha256").update(canonicalize(payload), "utf8").digest("hex");
}

export type ParsedBackup = {
  payload: BackupPayload;
  checksum?: { algorithm: "sha256"; value: string };
  checksumValid: boolean | null;
  counts: Record<(typeof ROW_COLLECTION_KEYS)[number] | (typeof SINGLETON_KEYS)[number], number>;
  warnings: string[];
};

export function parseBackupText(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Não foi possível ler o JSON do backup: ${(err as Error).message}`,
    );
  }

  let payload: BackupPayload;
  let checksum: ParsedBackup["checksum"];

  if (
    raw &&
    typeof raw === "object" &&
    "payload" in raw &&
    "checksum" in raw
  ) {
    const parsed = BackupFileSchema.parse(raw);
    payload = parsed.payload;
    checksum = parsed.checksum;
  } else {
    payload = BackupPayloadSchema.parse(raw);
  }

  if (!SUPPORTED_BACKUP_VERSIONS.includes(payload.version as 2 | 3)) {
    throw new Error(
      `Versão de backup não suportada: ${payload.version}. Suportadas: ${SUPPORTED_BACKUP_VERSIONS.join(", ")}.`,
    );
  }

  const warnings: string[] = [];
  let checksumValid: boolean | null = null;
  if (checksum) {
    const expected = computeChecksum(payload);
    checksumValid = expected === checksum.value;
    if (!checksumValid) {
      warnings.push(
        "Checksum do payload não confere — o arquivo pode ter sido editado após a exportação.",
      );
    }
  } else {
    warnings.push("Arquivo sem checksum (provavelmente versão 2 legada).");
  }

  if (payload.version < BACKUP_VERSION) {
    warnings.push(
      `Backup versão ${payload.version}; o sistema usa ${BACKUP_VERSION}. Campos novos não serão preenchidos.`,
    );
  }

  const counts = {
    eventSettings: payload.eventSettings ? 1 : 0,
    securitySettings: payload.securitySettings ? 1 : 0,
    honeymoon: payload.honeymoon ? 1 : 0,
    vendors: payload.vendors.length,
    vendorContacts: payload.vendorContacts.length,
    vendorNotes: payload.vendorNotes.length,
    contracts: payload.contracts.length,
    attachments: payload.attachments.length,
    venues: payload.venues.length,
    venueChecklistItems: payload.venueChecklistItems.length,
    budgetItems: payload.budgetItems.length,
    payments: payload.payments.length,
    incomes: payload.incomes.length,
    assets: payload.assets.length,
    savingsGoals: payload.savingsGoals.length,
    honeymoonItems: payload.honeymoonItems.length,
    trousseauItems: payload.trousseauItems.length,
    guestGroups: payload.guestGroups.length,
    guests: payload.guests.length,
    seatingTables: payload.seatingTables.length,
    gifts: payload.gifts.length,
    tasks: payload.tasks.length,
    users: payload.users?.length ?? 0,
    notificationLogs: payload.notificationLogs?.length ?? 0,
    auditLogs: payload.auditLogs?.length ?? 0,
  } as ParsedBackup["counts"];

  return { payload, checksum, checksumValid, counts, warnings };
}

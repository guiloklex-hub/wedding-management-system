export type SqlValue = string | number | bigint | null;

type EnumSpec = { values: readonly string[]; aliases?: Record<string, string> };
type FieldSpec =
  | { type: "string"; max: number }
  | { type: "int"; min: number; max: number }
  | { type: "float"; min: number; max: number }
  | { type: "bool" }
  | { type: "date" }
  | { type: "datetime" }
  | ({ type: "enum" } & EnumSpec);

const text = (max: number): FieldSpec => ({ type: "string", max });
const int = (min: number, max: number): FieldSpec => ({ type: "int", min, max });
const percent: FieldSpec = { type: "float", min: 0, max: 100 };
const bool: FieldSpec = { type: "bool" };
const day: FieldSpec = { type: "date" };
const instant: FieldSpec = { type: "datetime" };
const oneOf = (values: readonly string[], aliases?: Record<string, string>): FieldSpec =>
  ({ type: "enum", values, aliases });

const CURRENCIES = ["BRL", "USD", "EUR"] as const;

/**
 * Colunas web transportadas em `MobileRecord.extraJson`. A chave é o nome da
 * coluna Prisma; `aliases` aceita valores gravados pelo Android até a v1.1.0.
 */
export const EXTRA_FIELDS: Record<string, Record<string, FieldSpec>> = {
  vendor: {
    categoryKey: text(64), contractLink: text(2000), rating: int(1, 5), tags: text(2000), indicatedBy: text(120),
  },
  contact: { role: text(120), isPrimary: bool },
  contract: {
    version: int(1, 999), expiresAt: day, paymentTerms: text(8000), cancellationPolicy: text(8000),
    includedItems: text(8000), excludedItems: text(8000),
  },
  venue: {
    address: text(2000), mapsUrl: text(2000), capacitySeated: int(0, 100_000), capacityStanding: int(0, 100_000),
    pricingNotes: text(8000), restrictions: text(8000), pros: text(8000), cons: text(8000),
    isShortlisted: bool, contactName: text(120),
  },
  venue_check: { value: text(2000), sortOrder: int(0, 100_000) },
  payment: {
    method: oneOf(["PIX", "BOLETO", "CREDIT", "TRANSFER", "CASH"], { CREDIT_CARD: "CREDIT", TED: "TRANSFER" }),
    installmentNumber: int(1, 120), totalInstallments: int(1, 120),
    lateFeePercent: percent, interestPercentPerMonth: percent, paidAt: instant,
  },
  income: { frequency: oneOf(["ONE_TIME", "MONTHLY"]), givenByName: text(120) },
  goal: { imageUrl: text(2000), isActive: bool },
  honeymoon: { endDate: day, currency: oneOf(CURRENCIES) },
  honeymoon_item: {
    kind: oneOf(["FLIGHT", "HOTEL", "TRANSFER", "ACTIVITY", "DOCUMENT", "BAGGAGE", "OTHER"]),
    vendor: text(120), endAt: day, currency: oneOf(CURRENCIES), confirmationNumber: text(120),
  },
  trousseau: {
    room: oneOf(["KITCHEN", "BATHROOM", "BEDROOM", "LIVING", "LAUNDRY", "ELECTRONICS", "OTHER"], {
      COZINHA: "KITCHEN", BANHEIRO: "BATHROOM", QUARTO: "BEDROOM", SALA: "LIVING",
      LAVANDERIA: "LAUNDRY", ELETRONICOS: "ELECTRONICS", "ELETRÔNICOS": "ELECTRONICS", OUTRO: "OTHER",
    }),
    priority: oneOf(["ESSENTIAL", "NICE_TO_HAVE", "LUXURY"], { HIGH: "ESSENTIAL", MEDIUM: "NICE_TO_HAVE", LOW: "LUXURY" }),
    store: text(120), link: text(2000),
  },
  guest: {
    side: oneOf(["NOIVO", "NOIVA", "AMBOS"], { GROOM: "NOIVO", BRIDE: "NOIVA", BOTH: "AMBOS" }),
    dietary: text(2000), city: text(120), isVIP: bool, isPadrinho: bool, isChild: bool,
    age: int(0, 130), language: oneOf(["pt-BR", "en", "es"]), checkedInAt: instant,
  },
  group: { contactName: text(120) },
  tag: { color: text(32) },
  table: { shape: oneOf(["ROUND", "RECT", "SQUARE"]), sortOrder: int(0, 100_000) },
  gift: {
    type: oneOf(["CASH", "ITEM"]), giverName: text(120), thankedAt: instant, isHoneymoonShare: bool,
    pixPaidAt: instant, processedAt: instant,
  },
  task: {
    priority: oneOf(["LOW", "MEDIUM", "HIGH", "URGENT"]), responsible: text(120), venueId: text(64),
    templateKey: text(64), completedAt: instant, sortOrder: int(0, 100_000),
  },
};

/** Chaves do Android até a v1.1.0 que hoje usam o nome da coluna web. */
const LEGACY_KEYS: Record<string, Record<string, string>> = {
  honeymoon_item: { itemKind: "kind" },
};

const INVALID = Symbol("invalid");
type Parsed = SqlValue | boolean | typeof INVALID;

function epoch(value: unknown): number | null {
  if (typeof value === "string" && /^\d{9,13}$/.test(value.trim())) return epoch(Number(value));
  if (typeof value === "number" || typeof value === "bigint") {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.abs(number) > 100_000_000_000 ? number : number * 1000;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00.000Z`) : Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parse(spec: FieldSpec, value: unknown): Parsed {
  if (value == null || value === "") return null;
  switch (spec.type) {
    case "string": {
      const text = String(value).trim();
      return text ? text.slice(0, spec.max) : null;
    }
    case "int":
    case "float": {
      const number = typeof value === "number" ? value : Number(String(value).replace(",", "."));
      if (!Number.isFinite(number)) return INVALID;
      const normalized = spec.type === "int" ? Math.round(number) : number;
      return normalized < spec.min || normalized > spec.max ? INVALID : normalized;
    }
    case "bool":
      if (value === true || value === 1 || value === "1" || value === "true") return true;
      if (value === false || value === 0 || value === "0" || value === "false") return false;
      return INVALID;
    case "date":
    case "datetime": {
      const ms = epoch(value);
      return ms == null ? INVALID : ms;
    }
    case "enum": {
      const raw = String(value).trim();
      const upper = raw.toUpperCase();
      if (spec.values.includes(raw)) return raw;
      const match = spec.values.find((item) => item.toUpperCase() === upper) ?? spec.aliases?.[upper];
      return match ?? INVALID;
    }
  }
}

function canonicalKeys(kind: string, extra: Record<string, unknown>): Record<string, unknown> {
  const legacy = LEGACY_KEYS[kind];
  if (!legacy) return extra;
  const result = { ...extra };
  for (const [from, to] of Object.entries(legacy)) {
    if (result[to] == null && result[from] != null) result[to] = result[from];
    delete result[from];
  }
  return result;
}

/**
 * Converte o `extraJson` vindo do Android em colunas web. Valores fora do
 * domínio são omitidos para nunca sobrescrever um dado web válido com lixo.
 */
export function webExtraColumns(kind: string, extra: Record<string, unknown>): Record<string, SqlValue> {
  const specs = EXTRA_FIELDS[kind];
  if (!specs) return {};
  const source = canonicalKeys(kind, extra);
  const columns: Record<string, SqlValue> = {};
  for (const [column, spec] of Object.entries(specs)) {
    if (!(column in source)) continue;
    const parsed = parse(spec, source[column]);
    if (parsed === INVALID) continue;
    columns[column] = typeof parsed === "boolean" ? (parsed ? 1 : 0) : parsed;
  }
  return columns;
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Normaliza uma linha web para o `extraJson` do Android: booleanos como
 * true/false, datas como YYYY-MM-DD, instantes em milissegundos e sem nulos.
 */
export function mobileExtra(kind: string, row: Record<string, unknown>): Record<string, unknown> {
  const specs = EXTRA_FIELDS[kind] ?? {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value == null) continue;
    const spec = specs[key];
    if (!spec || spec.type === "string" || spec.type === "enum") {
      result[key] = typeof value === "bigint" ? Number(value) : value;
      continue;
    }
    const parsed = parse(spec, value);
    if (parsed === INVALID || parsed == null) continue;
    result[key] = spec.type === "date" ? isoDay(Number(parsed)) :
      typeof parsed === "bigint" ? Number(parsed) : parsed;
  }
  return result;
}

/** Valores aceitos em `Attachment.kind` (mesma lista de `attachmentActions`). */
export const ATTACHMENT_KINDS = ["CONTRACT", "PROPOSAL", "RECEIPT", "INVOICE", "ID_DOC", "PHOTO", "OTHER"] as const;

/**
 * Tipo e versão de um anexo vindo do Android. Até a v1.2 o Android gravava o
 * tipo genérico `ATTACHMENT`; ele vira `CONTRACT` no contrato e `OTHER` no resto.
 */
export function webAttachment(file: { kind: string; version?: number }, ownerKind: string): { kind: string; version: number } {
  const upper = file.kind.trim().toUpperCase();
  const kind = (ATTACHMENT_KINDS as readonly string[]).includes(upper) ? upper : ownerKind === "contract" ? "CONTRACT" : "OTHER";
  const version = Number.isInteger(file.version) && (file.version ?? 0) >= 1 && (file.version ?? 0) <= 999 ? (file.version as number) : 1;
  return { kind, version };
}

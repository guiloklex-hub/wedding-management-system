export type DetectedType =
  | "pdf"
  | "png"
  | "jpeg"
  | "webp"
  | "heic"
  | "xlsx"
  | "unknown";

const MIME_FOR_TYPE: Record<Exclude<DetectedType, "unknown">, ReadonlySet<string>> = {
  pdf: new Set(["application/pdf"]),
  png: new Set(["image/png"]),
  jpeg: new Set(["image/jpeg", "image/jpg"]),
  webp: new Set(["image/webp"]),
  heic: new Set(["image/heic", "image/heif"]),
  xlsx: new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
  ]),
};

export const ALLOWED_MIME_BY_KIND: Record<string, ReadonlySet<string>> = {
  CONTRACT: new Set(["application/pdf"]),
  INVOICE: new Set(["application/pdf", "image/png", "image/jpeg"]),
  RECEIPT: new Set(["application/pdf", "image/png", "image/jpeg"]),
  ID_DOC: new Set(["application/pdf", "image/png", "image/jpeg"]),
  PHOTO: new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/heic",
    "image/heif",
  ]),
  PROPOSAL: new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
  ]),
  OTHER: new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/heic",
    "image/heif",
  ]),
};

const MB = 1024 * 1024;

export const MAX_BYTES_BY_KIND: Record<string, number> = {
  CONTRACT: 8 * MB,
  INVOICE: 8 * MB,
  RECEIPT: 8 * MB,
  ID_DOC: 5 * MB,
  PHOTO: 10 * MB,
  PROPOSAL: 10 * MB,
  OTHER: 10 * MB,
};

export const DEFAULT_MAX_BYTES = 10 * MB;

const PDF_HEADER = Buffer.from("%PDF-", "ascii");
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF = Buffer.from("RIFF", "ascii");
const WEBP = Buffer.from("WEBP", "ascii");
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const HEIC_BRANDS = ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"];

export function detectMagic(buf: Buffer): DetectedType {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_HEADER)) return "png";
  if (buf.length >= 3 && buf.subarray(0, 3).equals(JPEG_HEADER)) return "jpeg";
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).equals(RIFF) &&
    buf.subarray(8, 12).equals(WEBP)
  ) {
    return "webp";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(4, 8).toString("ascii") === "ftyp" &&
    HEIC_BRANDS.includes(buf.subarray(8, 12).toString("ascii").toLowerCase())
  ) {
    return "heic";
  }
  if (buf.length >= PDF_HEADER.length) {
    const head = buf.subarray(0, Math.min(buf.length, 1024));
    if (head.indexOf(PDF_HEADER) !== -1) return "pdf";
  }
  if (buf.length >= 4 && buf.subarray(0, 4).equals(ZIP_HEADER)) return "xlsx";
  return "unknown";
}

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export function assertMagicMatchesMime(detected: DetectedType, mime: string): void {
  if (detected === "unknown") {
    throw new FileValidationError(
      "Não foi possível identificar o conteúdo real do arquivo.",
    );
  }
  const allowed = MIME_FOR_TYPE[detected];
  if (!allowed.has(mime.toLowerCase())) {
    throw new FileValidationError(
      "O conteúdo do arquivo não corresponde ao tipo informado.",
    );
  }
}

export function assertAllowedForKind(kind: string, mime: string): void {
  const allowed = ALLOWED_MIME_BY_KIND[kind];
  if (!allowed) {
    throw new FileValidationError("Tipo de anexo desconhecido.");
  }
  if (!allowed.has(mime.toLowerCase())) {
    throw new FileValidationError(
      `Formato não permitido para esta categoria (${kind}).`,
    );
  }
}

export function maxBytesForKind(kind: string): number {
  return MAX_BYTES_BY_KIND[kind] ?? DEFAULT_MAX_BYTES;
}

export function assertSizeForKind(kind: string, size: number): void {
  const max = maxBytesForKind(kind);
  if (size > max) {
    const mb = Math.round(max / MB);
    throw new FileValidationError(`Arquivo excede ${mb} MB para ${kind}.`);
  }
}

export const GUEST_IMPORT_MAX_BYTES = 5 * MB;

export function assertGuestImportSize(size: number): void {
  if (size > GUEST_IMPORT_MAX_BYTES) {
    const mb = Math.round(GUEST_IMPORT_MAX_BYTES / MB);
    throw new FileValidationError(`Arquivo excede ${mb} MB.`);
  }
}

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type StoredFile = {
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
};

function sanitizeFilename(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_");
  return cleaned.slice(0, 120) || "file";
}

export async function saveUpload(
  file: File,
  scope: { ownerType: string; ownerId: string },
): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Arquivo excede 10 MB.");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Formato não permitido. Use PDF, PNG, JPG, WEBP.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const safe = sanitizeFilename(file.name || "arquivo");
  const relativePath = path.join(scope.ownerType.toLowerCase(), scope.ownerId, `${hash}_${safe}`);
  const absolutePath = path.join(UPLOADS_ROOT, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);

  return {
    filename: safe,
    mimeType: file.type,
    size: file.size,
    storagePath: relativePath,
  };
}

export async function readUpload(storagePath: string): Promise<Buffer> {
  const safe = storagePath.replace(/\.\./g, "");
  const absolutePath = path.join(UPLOADS_ROOT, safe);
  return fs.readFile(absolutePath);
}

export async function removeUpload(storagePath: string): Promise<void> {
  try {
    const safe = storagePath.replace(/\.\./g, "");
    await fs.unlink(path.join(UPLOADS_ROOT, safe));
  } catch (err) {
    if (!(err instanceof Error && "code" in err && (err as { code?: string }).code === "ENOENT")) {
      console.error("[storage] remove failed", err);
    }
  }
}

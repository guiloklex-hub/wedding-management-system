import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

function uploadsRootPath(): string {
  return path.resolve(process.cwd(), "uploads");
}

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
  sha256Full: string;
  sha256Short: string;
};

export function sanitizeFilename(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_");
  return cleaned.slice(0, 120) || "file";
}

function resolveSafe(storagePath: string): string {
  const root = uploadsRootPath();
  const normalized = path.normalize(storagePath).replace(/^([/\\])+/, "");
  const abs = path.resolve(root, normalized);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error("Caminho inválido (path traversal detectado).");
  }
  return abs;
}

export async function saveUpload(
  file: File,
  scope: {
    ownerType: string;
    ownerId: string;
    subdir?: string;
    overrideExtension?: string;
  },
): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Arquivo excede 10 MB.");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Formato não permitido. Use PDF, PNG, JPG, WEBP.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256Full = createHash("sha256").update(bytes).digest("hex");
  const sha256Short = sha256Full.slice(0, 16);
  const safe = sanitizeFilename(file.name || "arquivo");

  const segments = [scope.ownerType.toLowerCase(), scope.ownerId];
  if (scope.subdir) {
    segments.push(scope.subdir.replace(/[^A-Za-z0-9._-]+/g, "_"));
  }
  segments.push(`${sha256Short}_${safe}`);
  const relativePath = path.posix.join(...segments);
  const absolutePath = resolveSafe(relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);

  return {
    filename: safe,
    mimeType: file.type,
    size: file.size,
    storagePath: relativePath,
    sha256Full,
    sha256Short,
  };
}

export async function readUpload(storagePath: string): Promise<Buffer> {
  const absolutePath = resolveSafe(storagePath);
  return fs.readFile(absolutePath);
}

export async function removeUpload(storagePath: string): Promise<void> {
  try {
    const absolutePath = resolveSafe(storagePath);
    await fs.unlink(absolutePath);
  } catch (err) {
    if (!(err instanceof Error && "code" in err && (err as { code?: string }).code === "ENOENT")) {
      console.error("[storage] remove failed", err);
    }
  }
}

export function uploadsRoot(): string {
  return uploadsRootPath();
}

export async function listAllUploads(): Promise<string[]> {
  const root = uploadsRootPath();
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) out.push(path.relative(root, full));
    }
  }
  await walk(root);
  return out;
}

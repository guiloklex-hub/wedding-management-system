import archiver from "archiver";
import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { finished } from "node:stream/promises";
import unzipper from "unzipper";

const MAGIC = Buffer.from("WFPBAK01", "ascii");
const ITERATIONS = 600_000;
const HEADER_SIZE = 40;
const TAG_SIZE = 16;

export type PortableEntry = { name: string; file?: string; bytes?: Buffer };
export type PortableManifest = {
  format: "wfp-portable";
  version: 2;
  origin: "web" | "android";
  lineageId: string;
  generation: number;
  exportedAt: number;
  records: number;
  files: number;
  hashes: Record<string, string>;
  locale: string;
  currency: string;
  webTables: Record<string, number>;
  schemas: { web: string | null; android: number };
  uploads: Record<string, { sha256: string; size: number }>;
  webDatabase: { sha256: string; size: number } | null;
};

export function sqliteSchemaHash(database: import("node:sqlite").DatabaseSync): string {
  const rows = database.prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name")
    .all() as { type: string; name: string; sql: string }[];
  return createHash("sha256").update(rows.map((row) => `${row.type}\t${row.name}\t${row.sql}`).join("\n")).digest("hex");
}

export function safeArchiveName(name: string): boolean {
  return name.length > 0 && !name.startsWith("/") && !name.includes("\\") &&
    name.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

export async function sha256File(file: string): Promise<{ sha256: string; size: number }> {
  const digest = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    digest.update(bytes);
    size += bytes.length;
  }
  return { sha256: digest.digest("hex"), size };
}

export async function writePortableFile(output: string, password: string, entries: PortableEntry[]): Promise<void> {
  if (password.length < 12) throw new Error("A senha do backup deve ter ao menos 12 caracteres");
  const names = new Set<string>();
  for (const entry of entries) {
    if (!safeArchiveName(entry.name) || names.has(entry.name) || (entry.file == null) === (entry.bytes == null)) {
      throw new Error("Entrada inválida ou repetida no backup");
    }
    names.add(entry.name);
  }
  const temporary = await fs.mkdtemp(path.join(tmpdir(), "wfp-write-"));
  try {
    const plain = path.join(temporary, "payload.zip");
    const archive = archiver("zip", { zlib: { level: 6 }, forceZip64: true });
    const outputZip = createWriteStream(plain, { mode: 0o600 });
    archive.on("error", (error) => outputZip.destroy(error));
    archive.pipe(outputZip);
    for (const entry of entries) {
      if (entry.file) archive.file(entry.file, { name: entry.name });
      else archive.append(entry.bytes!, { name: entry.name });
    }
    await archive.finalize();
    await finished(outputZip);

    const salt = randomBytes(16);
    const nonce = randomBytes(12);
    const header = Buffer.alloc(HEADER_SIZE);
    MAGIC.copy(header, 0);
    header.writeUInt32BE(ITERATIONS, 8);
    salt.copy(header, 12);
    nonce.copy(header, 28);
    const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(header);
    key.fill(0);
    const target = createWriteStream(output, { flags: "wx", mode: 0o600 });
    try {
      target.write(header);
      for await (const chunk of createReadStream(plain)) {
        if (!target.write(cipher.update(chunk))) await new Promise<void>((resolve) => target.once("drain", resolve));
      }
      target.write(cipher.final());
      target.end(cipher.getAuthTag());
      await finished(target);
    } catch (error) {
      target.destroy();
      await fs.unlink(output).catch(() => undefined);
      throw error;
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

export type OpenPortable = {
  manifest: PortableManifest;
  entries: Map<string, unzipper.File>;
  readJson<T>(name: string): Promise<T>;
  extract(name: string, target: string): Promise<void>;
};

export async function withPortableFile<T>(source: string, password: string,
  block: (archive: OpenPortable) => Promise<T>): Promise<T> {
  const temporary = await fs.mkdtemp(path.join(tmpdir(), "wfp-read-"));
  try {
    const plain = path.join(temporary, "payload.zip");
    const handle = await fs.open(source, "r");
    try {
      const { size: sourceSize } = await handle.stat();
      if (sourceSize < HEADER_SIZE + TAG_SIZE) throw new Error("Backup incompleto");
      const header = Buffer.alloc(HEADER_SIZE);
      const tag = Buffer.alloc(TAG_SIZE);
      await handle.read(header, 0, HEADER_SIZE, 0);
      await handle.read(tag, 0, TAG_SIZE, sourceSize - TAG_SIZE);
      if (!header.subarray(0, 8).equals(MAGIC)) throw new Error("Formato de backup desconhecido");
      const iterations = header.readUInt32BE(8);
      if (iterations < ITERATIONS || iterations > 2_000_000) throw new Error("Parâmetros de criptografia inválidos");
      const key = pbkdf2Sync(password, header.subarray(12, 28), iterations, 32, "sha256");
      const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(28, 40));
      decipher.setAAD(header);
      decipher.setAuthTag(tag);
      key.fill(0);
      const output = createWriteStream(plain, { mode: 0o600 });
      output.on("error", () => undefined);
      try {
        for await (const chunk of handle.createReadStream({ start: HEADER_SIZE, end: sourceSize - TAG_SIZE - 1, autoClose: false })) {
          if (!output.write(decipher.update(chunk))) await new Promise<void>((resolve) => output.once("drain", resolve));
        }
        output.end(decipher.final());
        await finished(output);
      } catch (error) {
        output.destroy();
        throw new Error(`Senha incorreta ou backup alterado: ${(error as Error).message}`);
      }
    } finally {
      await handle.close();
    }

    const directory = await unzipper.Open.file(plain);
    const entries = new Map<string, unzipper.File>();
    for (const entry of directory.files) {
      if (entry.type !== "File" || !safeArchiveName(entry.path) || entries.has(entry.path)) {
        throw new Error("Caminho inválido ou repetido no backup");
      }
      entries.set(entry.path, entry);
    }
    const readJson = async <V>(name: string): Promise<V> => {
      const entry = entries.get(name);
      if (!entry) throw new Error(`Entrada ausente: ${name}`);
      if (entry.uncompressedSize > 64_000_000) throw new Error(`JSON grande demais: ${name}`);
      return JSON.parse((await entry.buffer()).toString("utf8")) as V;
    };
    const manifest = await readJson<PortableManifest>("manifest.json");
    if (manifest.format !== "wfp-portable" || manifest.version !== 2) throw new Error("Versão não suportada");
    const extract = async (name: string, target: string): Promise<void> => {
      const entry = entries.get(name);
      if (!entry) throw new Error(`Entrada ausente: ${name}`);
      await fs.mkdir(path.dirname(target), { recursive: true });
      const output = createWriteStream(target, { flags: "wx", mode: 0o600 });
      try {
        for await (const chunk of entry.stream()) {
          if (!output.write(chunk)) await new Promise<void>((resolve) => output.once("drain", resolve));
        }
        output.end();
        await finished(output);
      } catch (error) {
        output.destroy();
        await fs.unlink(target).catch(() => undefined);
        throw error;
      }
    };
    return await block({ manifest, entries, readJson, extract });
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

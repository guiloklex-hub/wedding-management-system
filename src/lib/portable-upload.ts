import { createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export async function savePortableUpload(file: File): Promise<{ path: string; dispose(): Promise<void> }> {
  if (!file.size) throw new Error("Arquivo vazio");
  const directory = await fs.mkdtemp(path.join(tmpdir(), "wfp-upload-"));
  const destination = path.join(directory, "incoming.wfpbackup");
  try {
    await pipeline(Readable.fromWeb(file.stream() as never), createWriteStream(destination, { mode: 0o600 }));
    return { path: destination, dispose: () => fs.rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

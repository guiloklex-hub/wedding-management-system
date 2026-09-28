import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { databasePath } from "./portable-export";

const lockPath = () => path.join(process.cwd(), ".portable-operation.lock");
const journalPath = () => path.join(process.cwd(), ".portable-restore-journal.json");
type Journal = { pid: number; reversal: string; phase: "prepared" | "files" | "database" };
let recovering: Promise<void> | null = null;

function pidAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function clearStaleLock(): void {
  if (!existsSync(lockPath()) || existsSync(journalPath())) return;
  const owner = Number(readFileSync(lockPath(), "utf8"));
  if (pidAlive(owner)) return;
  if (Date.now() - statSync(lockPath()).mtimeMs < 60_000) return;
  unlinkSync(lockPath());
}

export async function recoverInterruptedRestore(): Promise<void> {
  if (!existsSync(journalPath())) return;
  if (recovering) return recovering;
  recovering = (async () => {
    const journal = JSON.parse(await fs.readFile(journalPath(), "utf8")) as Journal;
    if (pidAlive(journal.pid) && journal.pid !== process.pid) {
      throw new Error("Outra instância está restaurando dados");
    }
    if (journal.pid === process.pid) throw new Error("Restauração em andamento");
    const rollbackDb = path.join(journal.reversal, "web.sqlite");
    const rollbackUploads = path.join(journal.reversal, "uploads");
    const db = new DatabaseSync(rollbackDb, { readOnly: true });
    try { await backup(db, databasePath()); } finally { db.close(); }
    if (existsSync(rollbackUploads)) {
      await fs.rm(path.join(process.cwd(), "uploads"), { recursive: true, force: true });
      await fs.cp(rollbackUploads, path.join(process.cwd(), "uploads"), { recursive: true });
    }
    const rollbackState = path.join(journal.reversal, "android-state");
    await fs.rm(path.join(process.cwd(), ".portable-state"), { recursive: true, force: true });
    if (existsSync(rollbackState)) {
      await fs.cp(rollbackState, path.join(process.cwd(), ".portable-state"), { recursive: true });
    }
    await fs.rm(journalPath(), { force: true });
    await fs.rm(lockPath(), { force: true });
  })();
  try { await recovering; } finally { recovering = null; }
}

export async function assertPortableReady(): Promise<void> {
  if (existsSync(journalPath())) await recoverInterruptedRestore();
  clearStaleLock();
  if (existsSync(lockPath())) {
    throw new Error("Backup ou restauração em andamento; tente novamente depois");
  }
}

export function assertPortableFilesWritable(): void {
  clearStaleLock();
  if (existsSync(lockPath())) throw new Error("Backup ou restauração em andamento; tente novamente depois");
}

export async function acquirePortableOperation(): Promise<() => Promise<void>> {
  await recoverInterruptedRestore();
  clearStaleLock();
  const file = await fs.open(lockPath(), "wx", 0o600);
  try { await file.writeFile(String(process.pid)); } finally { await file.close(); }
  return async () => { await fs.rm(lockPath(), { force: true }); };
}

export async function writeRestoreJournal(reversal: string, phase: Journal["phase"]): Promise<void> {
  const value: Journal = { pid: process.pid, reversal, phase };
  await fs.writeFile(journalPath(), JSON.stringify(value), { mode: 0o600 });
}

export async function clearRestoreJournal(): Promise<void> {
  await fs.rm(journalPath(), { force: true });
}

export function activeRestoreJournal(): Journal | null {
  if (!existsSync(journalPath())) return null;
  return JSON.parse(readFileSync(journalPath(), "utf8")) as Journal;
}

export async function createLegacyReversal(): Promise<string> {
  const reversal = path.join(process.cwd(), ".portable-reversions", `${Date.now()}-${randomUUID()}`);
  await fs.mkdir(reversal, { recursive: true, mode: 0o700 });
  try {
    const db = new DatabaseSync(databasePath(), { readOnly: true });
    try { await backup(db, path.join(reversal, "web.sqlite")); } finally { db.close(); }
    const uploads = path.join(process.cwd(), "uploads");
    if (existsSync(uploads)) await fs.cp(uploads, path.join(reversal, "uploads"), { recursive: true });
    const portableState = path.join(process.cwd(), ".portable-state");
    if (existsSync(portableState)) {
      await fs.cp(portableState, path.join(reversal, "android-state"), { recursive: true });
    }
    return reversal;
  } catch (error) {
    await fs.rm(reversal, { recursive: true, force: true });
    throw error;
  }
}

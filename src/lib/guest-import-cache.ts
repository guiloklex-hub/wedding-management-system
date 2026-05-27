import { randomBytes } from "node:crypto";
import type { ImporterId, ParsedRow } from "./guest-importers";

export type GuestImportEntry = {
  userId: string;
  source: ImporterId;
  rows: ParsedRow[];
  createdAt: number;
};

const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 50;
const MAX_ROWS = 2000;

const cache = new Map<string, GuestImportEntry>();

function now(): number {
  return Date.now();
}

function sweep(current: number): void {
  for (const [k, v] of cache) {
    if (current - v.createdAt > TTL_MS) cache.delete(k);
  }
}

function enforceCap(): void {
  if (cache.size <= MAX_ENTRIES) return;
  // Remove a entrada mais antiga.
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [k, v] of cache) {
    if (v.createdAt < oldestAt) {
      oldestAt = v.createdAt;
      oldestKey = k;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

export function putImport(userId: string, source: ImporterId, rows: ParsedRow[]): string {
  const current = now();
  sweep(current);
  const trimmed = rows.slice(0, MAX_ROWS);
  const token = randomBytes(18).toString("base64url");
  cache.set(token, { userId, source, rows: trimmed, createdAt: current });
  enforceCap();
  return token;
}

export function takeImport(userId: string, token: string): GuestImportEntry | null {
  const entry = cache.get(token);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  if (now() - entry.createdAt > TTL_MS) {
    cache.delete(token);
    return null;
  }
  return entry;
}

export function consumeImport(userId: string, token: string): GuestImportEntry | null {
  const entry = takeImport(userId, token);
  if (entry) cache.delete(token);
  return entry;
}

// Utilizado apenas por testes.
export function __resetGuestImportCache(): void {
  cache.clear();
}

export const GUEST_IMPORT_CACHE_TTL_MS = TTL_MS;
export const GUEST_IMPORT_CACHE_MAX_ENTRIES = MAX_ENTRIES;

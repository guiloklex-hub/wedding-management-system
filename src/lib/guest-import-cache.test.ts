import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  putImport,
  takeImport,
  consumeImport,
  __resetGuestImportCache,
  GUEST_IMPORT_CACHE_TTL_MS,
  GUEST_IMPORT_CACHE_MAX_ENTRIES,
} from "./guest-import-cache";
import type { ParsedRow } from "./guest-importers";

function row(name: string): ParsedRow {
  return {
    name,
    groupName: null,
    phone: null,
    email: null,
    rsvpStatus: "INVITED",
    rsvpStatusRaw: null,
    tags: [],
    isChild: false,
    age: null,
    pin: null,
    rawSource: {},
  };
}

beforeEach(() => __resetGuestImportCache());
afterEach(() => vi.useRealTimers());

describe("guest-import-cache", () => {
  it("put + take retorna a entry para o mesmo usuário", () => {
    const token = putImport("u1", "wedy", [row("A")]);
    const entry = takeImport("u1", token);
    expect(entry).not.toBeNull();
    expect(entry?.rows[0].name).toBe("A");
  });

  it("take com userId diferente retorna null (anti-IDOR)", () => {
    const token = putImport("u1", "wedy", [row("A")]);
    expect(takeImport("u2", token)).toBeNull();
  });

  it("consume remove a entry após retornar", () => {
    const token = putImport("u1", "wedy", [row("A")]);
    expect(consumeImport("u1", token)).not.toBeNull();
    expect(takeImport("u1", token)).toBeNull();
  });

  it("entry expira após TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T10:00:00Z"));
    const token = putImport("u1", "wedy", [row("A")]);
    expect(takeImport("u1", token)).not.toBeNull();
    vi.setSystemTime(new Date(Date.now() + GUEST_IMPORT_CACHE_TTL_MS + 1));
    expect(takeImport("u1", token)).toBeNull();
  });

  it("hard cap purga a entrada mais antiga", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T10:00:00Z"));
    const tokens: string[] = [];
    for (let i = 0; i < GUEST_IMPORT_CACHE_MAX_ENTRIES; i++) {
      tokens.push(putImport(`u${i}`, "wedy", [row(`R${i}`)]));
      vi.setSystemTime(new Date(Date.now() + 100));
    }
    const oldest = tokens[0];
    expect(takeImport("u0", oldest)).not.toBeNull();
    putImport("uNew", "wedy", [row("New")]);
    expect(takeImport("u0", oldest)).toBeNull();
  });

  it("limita rows a 2000", () => {
    const tooMany = Array.from({ length: 2500 }, (_, i) => row(`R${i}`));
    const token = putImport("u1", "wedy", tooMany);
    const entry = takeImport("u1", token);
    expect(entry?.rows.length).toBe(2000);
  });
});

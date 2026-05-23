import { describe, expect, it } from "vitest";
import {
  BACKUP_VERSION,
  canonicalize,
  computeChecksum,
  parseBackupText,
  type BackupPayload,
} from "./backup";

function emptyPayload(): BackupPayload {
  return {
    version: BACKUP_VERSION,
    exportedAt: "2026-01-01T00:00:00.000Z",
    eventSettings: { id: "singleton" },
    securitySettings: { id: "singleton" },
    vendors: [],
    vendorContacts: [],
    vendorNotes: [],
    contracts: [],
    attachments: [],
    venues: [],
    venueChecklistItems: [],
    budgetItems: [],
    payments: [],
    incomes: [],
    assets: [],
    savingsGoals: [],
    honeymoon: null,
    honeymoonItems: [],
    trousseauItems: [],
    guestGroups: [],
    guests: [],
    seatingTables: [],
    gifts: [],
    tasks: [],
  };
}

describe("canonicalize", () => {
  it("ordena chaves de objeto para hash determinístico", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it("preserva ordem de arrays", () => {
    expect(canonicalize([1, 2, 3])).not.toBe(canonicalize([3, 2, 1]));
  });
});

describe("computeChecksum", () => {
  it("retorna sha256 hex de 64 chars", () => {
    const hash = computeChecksum(emptyPayload());
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("é determinístico para payloads idênticos", () => {
    expect(computeChecksum(emptyPayload())).toBe(computeChecksum(emptyPayload()));
  });

  it("muda quando o conteúdo muda", () => {
    const a = emptyPayload();
    const b = emptyPayload();
    b.vendors = [{ id: "v1", name: "Test" } as never];
    expect(computeChecksum(a)).not.toBe(computeChecksum(b));
  });
});

describe("parseBackupText", () => {
  it("aceita payload v2 legado sem envelope", () => {
    const payload = { ...emptyPayload(), version: 2 };
    const text = JSON.stringify(payload);
    const result = parseBackupText(text);
    expect(result.payload.version).toBe(2);
    expect(result.checksum).toBeUndefined();
    expect(result.checksumValid).toBeNull();
    expect(result.warnings).toContain(
      "Arquivo sem checksum (provavelmente versão 2 legada).",
    );
  });

  it("aceita arquivo com envelope { checksum, payload } e valida o hash", () => {
    const payload = emptyPayload();
    const file = {
      checksum: { algorithm: "sha256" as const, value: computeChecksum(payload) },
      payload,
    };
    const result = parseBackupText(JSON.stringify(file));
    expect(result.checksumValid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("flagga checksum inválido", () => {
    const payload = emptyPayload();
    const file = {
      checksum: { algorithm: "sha256" as const, value: "a".repeat(64) },
      payload,
    };
    const result = parseBackupText(JSON.stringify(file));
    expect(result.checksumValid).toBe(false);
    expect(result.warnings.some((w) => w.includes("Checksum"))).toBe(true);
  });

  it("rejeita versão desconhecida", () => {
    const payload = { ...emptyPayload(), version: 99 };
    expect(() => parseBackupText(JSON.stringify(payload))).toThrow(
      /Versão de backup não suportada/,
    );
  });

  it("rejeita JSON malformado", () => {
    expect(() => parseBackupText("{not json")).toThrow(/Não foi possível ler/);
  });

  it("conta linhas corretamente", () => {
    const payload = emptyPayload();
    payload.vendors = [{ id: "v1" }, { id: "v2" }];
    payload.payments = [{ id: "p1" }];
    payload.users = [{ id: "u1", email: "x", password: "x", role: "ADMIN" }];
    const file = {
      checksum: { algorithm: "sha256" as const, value: computeChecksum(payload) },
      payload,
    };
    const result = parseBackupText(JSON.stringify(file));
    expect(result.counts.vendors).toBe(2);
    expect(result.counts.payments).toBe(1);
    expect(result.counts.users).toBe(1);
  });
});

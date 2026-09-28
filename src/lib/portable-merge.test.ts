import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { mergeMobileRecords } from "./portable-merge";
import type { MobileRecord } from "./portable-projection";

function guest(id: string): MobileRecord {
  return {
    id, kind: "guest", title: "Ana", subtitle: "", amountCents: null, estimatedCents: null,
    date: null, status: "INVITED", parentId: null, guestGroupId: null, seatingTableId: null,
    plusOnesAllowed: 0, plusOnesConfirmed: 0, phone: "", email: "", notes: "", extraJson: "{}",
    createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, deletedAt: null,
  };
}

function database(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE Guest (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, phone TEXT, email TEXT, notes TEXT, side TEXT,
    rsvpStatus TEXT NOT NULL, rsvpToken TEXT NOT NULL UNIQUE, rsvpPin TEXT,
    groupId TEXT, tableId TEXT, plusOnesAllowed INTEGER NOT NULL, plusOnesConfirmed INTEGER NOT NULL,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT
  );
  CREATE TABLE GuestTagOnGuest (guestId TEXT NOT NULL, tagId TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE Vendor (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL,
    status TEXT, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT);
  INSERT INTO Guest (id,name,rsvpStatus,rsvpToken,rsvpPin,side,plusOnesAllowed,plusOnesConfirmed,createdAt,updatedAt)
    VALUES ('old','Ana','INVITED','original-token','4821','BRIDE',0,0,'2023-11-14T22:13:20.000Z','2023-11-14T22:13:20.000Z');`);
  return db;
}

describe("transferência móvel para web", () => {
  it("aplica só campos equivalentes e conserva o PIN web", () => {
    const db = database();
    try {
      const initial = { ...guest("old"), extraJson: JSON.stringify({ side: "BRIDE" }) };
      const changed = { ...initial, title: "Ana Editada", phone: "+5511999999999", updatedAt: initial.updatedAt + 1000,
        extraJson: JSON.stringify({ side: "GROOM" }) };
      const created = { ...guest("new"), title: "Bia", createdAt: initial.createdAt + 2000 };
      const report = mergeMobileRecords(db, [changed, created], [initial]);
      expect(report).toMatchObject({ changed: 1, created: 1, deleted: 0 });
      expect(db.prepare("SELECT name, phone, rsvpPin, rsvpToken, side FROM Guest WHERE id = 'old'").get())
        .toMatchObject({ name: "Ana Editada", phone: "+5511999999999", rsvpPin: "4821", rsvpToken: "original-token", side: "BRIDE" });
      expect(db.prepare("SELECT name, rsvpToken FROM Guest WHERE id = 'new'").get())
        .toMatchObject({ name: "Bia", rsvpToken: expect.any(String) });
    } finally { db.close(); }
  });

  it("bloqueia criação sem categoria e desfaz mudanças anteriores", () => {
    const db = database();
    try {
      const initial = guest("old");
      const changed = { ...initial, title: "Mudança que não deve entrar" };
      const invalid = { ...guest("new-vendor"), kind: "vendor", title: "Novo fornecedor" };
      expect(() => mergeMobileRecords(db, [changed, invalid], [initial]))
        .toThrow("vendor new-vendor: falta category");
      expect(db.prepare("SELECT name FROM Guest WHERE id = 'old'").get()).toMatchObject({ name: "Ana" });
      expect(db.prepare("SELECT count(*) AS n FROM Vendor").get()).toMatchObject({ n: 0 });
    } finally { db.close(); }
  });
});

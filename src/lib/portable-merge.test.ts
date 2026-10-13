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
  it("sem fieldMap aplica só colunas fixas e conserva o PIN web", () => {
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

  it("com fieldMap aplica extras normalizados sem tocar campos não editados", () => {
    const db = database();
    try {
      db.exec(`ALTER TABLE Guest ADD COLUMN isVIP INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE Guest ADD COLUMN isChild INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE Guest ADD COLUMN dietary TEXT;
        UPDATE Guest SET side = 'NOIVA', isChild = 1, dietary = 'Vegana' WHERE id = 'old';`);
      const initial = { ...guest("old"), extraJson: JSON.stringify({ side: "NOIVA", isVIP: 0, isChild: 1, dietary: "Vegana" }) };
      const changed = { ...initial, extraJson: JSON.stringify({ side: "GROOM", isVIP: true, isChild: true, dietary: "Vegana" }) };
      const report = mergeMobileRecords(db, [changed], [initial], { applyExtras: true });
      expect(report.changed).toBe(1);
      expect(db.prepare("SELECT side, isVIP, isChild, dietary FROM Guest WHERE id = 'old'").get())
        .toMatchObject({ side: "NOIVO", isVIP: 1, isChild: 1, dietary: "Vegana" });
    } finally { db.close(); }
  });

  it("ignora valores fora do domínio em vez de sobrescrever o web", () => {
    const db = database();
    try {
      db.exec("UPDATE Guest SET side = 'NOIVA' WHERE id = 'old'");
      const initial = { ...guest("old"), extraJson: JSON.stringify({ side: "NOIVA" }) };
      const changed = { ...initial, extraJson: JSON.stringify({ side: "PADRINHO" }) };
      expect(mergeMobileRecords(db, [changed], [initial], { applyExtras: true }).changed).toBe(0);
      expect(db.prepare("SELECT side FROM Guest WHERE id = 'old'").get()).toMatchObject({ side: "NOIVA" });
    } finally { db.close(); }
  });

  it("leva título do pagamento para notes e descrição da tarefa para description", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`CREATE TABLE Vendor (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL,
          status TEXT, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT);
        CREATE TABLE Payment (id TEXT PRIMARY KEY NOT NULL, amount REAL NOT NULL, dueDate INTEGER NOT NULL,
          status TEXT NOT NULL, method TEXT, notes TEXT, vendorId TEXT NOT NULL, createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL, deletedAt TEXT);
        CREATE TABLE Task (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, description TEXT, deadline INTEGER,
          status TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'MEDIUM', vendorId TEXT, createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL, deletedAt TEXT);
        INSERT INTO Vendor VALUES ('v','Buffet','Buffet','CONTRACTED',NULL,'x','x',NULL);
        INSERT INTO Payment VALUES ('p',100,1700000000000,'PENDING','PIX','Sinal','v','x','x',NULL);
        INSERT INTO Task VALUES ('t','Provar menu','Levar lista',NULL,'TODO','MEDIUM',NULL,'x','x',NULL);`);
      const payment = { ...guest("p"), kind: "payment", title: "Sinal", notes: "Sinal", status: "PENDING",
        amountCents: 10000, date: "2023-11-14", parentId: "v", extraJson: JSON.stringify({ method: "PIX" }) };
      const task = { ...guest("t"), kind: "task", title: "Provar menu", notes: "Levar lista", status: "TODO",
        extraJson: JSON.stringify({ priority: "MEDIUM" }) };
      mergeMobileRecords(db, [
        { ...payment, title: "Sinal do buffet", extraJson: JSON.stringify({ method: "CREDIT_CARD" }) },
        { ...task, notes: "Levar lista e alergias", extraJson: JSON.stringify({ priority: "URGENT" }) },
      ], [payment, task], { applyExtras: true });
      expect(db.prepare("SELECT notes, method FROM Payment WHERE id = 'p'").get())
        .toMatchObject({ notes: "Sinal do buffet", method: "CREDIT" });
      expect(db.prepare("SELECT description, priority FROM Task WHERE id = 't'").get())
        .toMatchObject({ description: "Levar lista e alergias", priority: "URGENT" });
    } finally { db.close(); }
  });

  it("grava a lua de mel criada no Android como singleton e religa os itens", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`CREATE TABLE Honeymoon (id TEXT PRIMARY KEY NOT NULL, destination TEXT, startDate INTEGER, budget REAL,
          currency TEXT NOT NULL DEFAULT 'BRL', notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
        CREATE TABLE HoneymoonItem (id TEXT PRIMARY KEY NOT NULL, honeymoonId TEXT NOT NULL REFERENCES Honeymoon(id),
          kind TEXT NOT NULL DEFAULT 'ACTIVITY', title TEXT NOT NULL, amount REAL, startAt INTEGER, status TEXT NOT NULL,
          notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT);`);
      db.exec("PRAGMA foreign_keys = ON");
      const trip = { ...guest("android-trip"), kind: "honeymoon", title: "Lisboa", status: "" };
      const flight = { ...guest("android-flight"), kind: "honeymoon_item", title: "Voo", status: "BOOKED",
        parentId: "android-trip", extraJson: JSON.stringify({ itemKind: "FLIGHT" }) };
      mergeMobileRecords(db, [flight, trip], []);
      expect(db.prepare("SELECT id, destination FROM Honeymoon").all()).toEqual([{ id: "singleton", destination: "Lisboa" }]);
      expect(db.prepare("SELECT honeymoonId, kind FROM HoneymoonItem").get())
        .toMatchObject({ honeymoonId: "singleton", kind: "FLIGHT" });
    } finally { db.close(); }
  });

  it("atualiza a lua de mel singleton existente sem colunas inexistentes", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`CREATE TABLE Honeymoon (id TEXT PRIMARY KEY NOT NULL, destination TEXT, startDate INTEGER, budget REAL,
          currency TEXT NOT NULL DEFAULT 'BRL', notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
        INSERT INTO Honeymoon (id, destination, createdAt, updatedAt) VALUES ('singleton', 'Recife', 'x', 'x');`);
      const singleton = { ...guest("singleton"), kind: "honeymoon", title: "Recife", status: "", deletedAt: 1 };
      const replacement = { ...guest("android-trip"), kind: "honeymoon", title: "Lisboa", status: "" };
      const removed = { ...guest("android-old"), kind: "honeymoon", title: "Roma", status: "", deletedAt: 2 };
      mergeMobileRecords(db, [singleton, removed, replacement], [{ ...singleton, deletedAt: null }]);
      expect(db.prepare("SELECT id, destination FROM Honeymoon").all()).toEqual([{ id: "singleton", destination: "Lisboa" }]);
    } finally { db.close(); }
  });

  it("mantém ativo ligado a meta criada no mesmo backup e preserva colunas web sem mapeamento", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`CREATE TABLE SavingsGoal (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, targetAmount REAL NOT NULL,
          targetDate INTEGER, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT);
        CREATE TABLE Asset (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, amount REAL NOT NULL, date INTEGER NOT NULL,
          notes TEXT, goalId TEXT REFERENCES SavingsGoal(id), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT);
        CREATE TABLE SeatingTable (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, capacity INTEGER NOT NULL,
          x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 0, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
          deletedAt TEXT);
        INSERT INTO Asset VALUES ('a','Poupança',100,1700000000000,NULL,NULL,'x','x',NULL);`);
      db.exec("PRAGMA foreign_keys = ON");
      const asset = { ...guest("a"), kind: "asset", title: "Poupança", status: "", amountCents: 10000, date: "2023-11-14" };
      const goal = { ...guest("g"), kind: "goal", title: "Viagem", status: "", amountCents: 500000 };
      const table = { ...guest("t"), kind: "table", title: "Mesa 1", status: "", amountCents: 8,
        extraJson: JSON.stringify({ x: 120.5, y: 40, shape: "ROUND" }) };
      mergeMobileRecords(db, [{ ...asset, parentId: "g" }, goal, table], [asset], { applyExtras: true });
      expect(db.prepare("SELECT goalId FROM Asset WHERE id = 'a'").get()).toMatchObject({ goalId: "g" });
      expect(db.prepare("SELECT x, y FROM SeatingTable WHERE id = 't'").get()).toMatchObject({ x: 120.5, y: 40 });
    } finally { db.close(); }
  });
});

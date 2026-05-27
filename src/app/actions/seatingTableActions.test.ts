import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

import { assignGuestToTable, reorderSeatingTables } from "./seatingTableActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  authMock.mockReset();
  authMock.mockResolvedValue({ user: { id: "test-user", role: "ADMIN" } });
  prismaMock.auditLog.create.mockResolvedValue({} as never);
  // Suporta as duas formas usadas pelas actions: callback (assign) e array (reorder).
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
});

describe("assignGuestToTable", () => {
  it("rejeita guestId inválido sem tocar o banco", async () => {
    const res = await assignGuestToTable("", "t1");
    expect(res.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita tableId inválido (acima de 64 chars)", async () => {
    const res = await assignGuestToTable("g1", "x".repeat(65));
    expect(res.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("erro quando a mesa não existe", async () => {
    prismaMock.seatingTable.findUnique.mockResolvedValue(null as never);
    const res = await assignGuestToTable("g1", "t1");
    expect(res).toEqual({ success: false, error: "Mesa não encontrada" });
  });

  it("erro quando o convidado não existe ou está arquivado", async () => {
    prismaMock.seatingTable.findUnique.mockResolvedValue({ id: "t1", name: "Mesa 1", capacity: 8 } as never);
    prismaMock.guest.findMany.mockResolvedValue([] as never);
    prismaMock.guest.findUnique.mockResolvedValue({ plusOnesConfirmed: 0, deletedAt: new Date() } as never);
    const res = await assignGuestToTable("g1", "t1");
    expect(res).toEqual({ success: false, error: "Convidado não encontrado" });
    expect(prismaMock.guest.updateMany).not.toHaveBeenCalled();
  });

  it("recusa quando os +1 do novo convidado estouram a capacidade", async () => {
    // cap 3, 1 assento ocupado, novo convidado precisa de 3 (1 + 2 acompanhantes) -> 4 > 3
    prismaMock.seatingTable.findUnique.mockResolvedValue({ id: "t1", name: "Mesa 1", capacity: 3 } as never);
    prismaMock.guest.findMany.mockResolvedValue([{ id: "g2", plusOnesConfirmed: 0 }] as never);
    prismaMock.guest.findUnique.mockResolvedValue({ plusOnesConfirmed: 2, deletedAt: null } as never);
    const res = await assignGuestToTable("g1", "t1");
    expect(res.success).toBe(false);
    expect(prismaMock.guest.updateMany).not.toHaveBeenCalled();
  });

  it("conta os +1 dos convidados já alocados ao validar capacidade", async () => {
    // cap 4, um convidado com +3 já ocupa 4 assentos; novo simples (1) -> 5 > 4
    prismaMock.seatingTable.findUnique.mockResolvedValue({ id: "t1", name: "Mesa 1", capacity: 4 } as never);
    prismaMock.guest.findMany.mockResolvedValue([{ id: "g2", plusOnesConfirmed: 3 }] as never);
    prismaMock.guest.findUnique.mockResolvedValue({ plusOnesConfirmed: 0, deletedAt: null } as never);
    const res = await assignGuestToTable("g1", "t1");
    expect(res.success).toBe(false);
  });

  it("exclui o próprio convidado da contagem ao reatribuir", async () => {
    prismaMock.seatingTable.findUnique.mockResolvedValue({ id: "t1", name: "Mesa 1", capacity: 8 } as never);
    prismaMock.guest.findMany.mockResolvedValue([] as never);
    prismaMock.guest.findUnique.mockResolvedValue({ plusOnesConfirmed: 0, deletedAt: null } as never);
    prismaMock.guest.updateMany.mockResolvedValue({ count: 1 } as never);
    await assignGuestToTable("g1", "t1");
    expect(prismaMock.guest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tableId: "t1", NOT: { id: "g1" } }),
      }),
    );
  });

  it("aloca com sucesso e registra audit ASSIGN_TABLE", async () => {
    prismaMock.seatingTable.findUnique.mockResolvedValue({ id: "t1", name: "Mesa 1", capacity: 8 } as never);
    prismaMock.guest.findMany.mockResolvedValue([] as never);
    prismaMock.guest.findUnique.mockResolvedValue({ plusOnesConfirmed: 1, deletedAt: null } as never);
    prismaMock.guest.updateMany.mockResolvedValue({ count: 1 } as never);
    const res = await assignGuestToTable("g1", "t1");
    expect(res).toEqual({ success: true });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ASSIGN_TABLE", entity: "Guest", entityId: "g1" }),
      }),
    );
  });

  it("desaloca (tableId null) sem validar capacidade e registra UNASSIGN_TABLE", async () => {
    prismaMock.guest.updateMany.mockResolvedValue({ count: 1 } as never);
    const res = await assignGuestToTable("g1", null);
    expect(res).toEqual({ success: true });
    expect(prismaMock.seatingTable.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "UNASSIGN_TABLE" }) }),
    );
  });

  it("erro quando o convidado some entre a checagem e o update (count 0)", async () => {
    prismaMock.guest.updateMany.mockResolvedValue({ count: 0 } as never);
    const res = await assignGuestToTable("g1", null);
    expect(res).toEqual({ success: false, error: "Convidado não encontrado" });
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("reorderSeatingTables", () => {
  it("rejeita lista vazia sem tocar o banco", async () => {
    const res = await reorderSeatingTables([]);
    expect(res.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita id acima de 64 chars", async () => {
    const res = await reorderSeatingTables(["x".repeat(65)]);
    expect(res.success).toBe(false);
  });

  it("persiste sortOrder sequencial e registra audit REORDER", async () => {
    prismaMock.seatingTable.updateMany.mockResolvedValue({ count: 1 } as never);
    const res = await reorderSeatingTables(["t3", "t1", "t2"]);
    expect(res).toEqual({ success: true });
    expect(prismaMock.seatingTable.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "t3" }), data: { sortOrder: 0 } }),
    );
    expect(prismaMock.seatingTable.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "t2" }), data: { sortOrder: 2 } }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "REORDER" }) }),
    );
  });
});

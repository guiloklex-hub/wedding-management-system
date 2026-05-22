import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

import { GET } from "./route";

beforeEach(() => {
  authMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function mockEmptyTables() {
  prismaMock.eventSettings.findUnique.mockResolvedValue({ id: "singleton" } as never);
  prismaMock.securitySettings.findUnique.mockResolvedValue({ id: "singleton" } as never);
  prismaMock.vendor.findMany.mockResolvedValue([] as never);
  prismaMock.vendorContact.findMany.mockResolvedValue([] as never);
  prismaMock.vendorNote.findMany.mockResolvedValue([] as never);
  prismaMock.contract.findMany.mockResolvedValue([] as never);
  prismaMock.attachment.findMany.mockResolvedValue([] as never);
  prismaMock.venue.findMany.mockResolvedValue([] as never);
  prismaMock.venueChecklistItem.findMany.mockResolvedValue([] as never);
  prismaMock.budgetItem.findMany.mockResolvedValue([] as never);
  prismaMock.payment.findMany.mockResolvedValue([] as never);
  prismaMock.income.findMany.mockResolvedValue([] as never);
  prismaMock.asset.findMany.mockResolvedValue([] as never);
  prismaMock.savingsGoal.findMany.mockResolvedValue([] as never);
  prismaMock.honeymoon.findUnique.mockResolvedValue(null as never);
  prismaMock.honeymoonItem.findMany.mockResolvedValue([] as never);
  prismaMock.trousseauItem.findMany.mockResolvedValue([] as never);
  prismaMock.guestGroup.findMany.mockResolvedValue([] as never);
  prismaMock.guest.findMany.mockResolvedValue([] as never);
  prismaMock.seatingTable.findMany.mockResolvedValue([] as never);
  prismaMock.gift.findMany.mockResolvedValue([] as never);
  prismaMock.task.findMany.mockResolvedValue([] as never);
}

describe("GET /api/backup", () => {
  it("retorna 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("retorna 200 JSON com headers de download", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    mockEmptyTables();

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(res.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="wedding-backup-\d{4}-\d{2}-\d{2}\.json"/,
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("payload contém exportedAt, version e todas as coleções esperadas", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const sample = { id: "v1" };
    mockEmptyTables();
    prismaMock.vendor.findMany.mockResolvedValue([sample] as never);
    prismaMock.budgetItem.findMany.mockResolvedValue([sample] as never);
    prismaMock.payment.findMany.mockResolvedValue([sample] as never);
    prismaMock.asset.findMany.mockResolvedValue([sample] as never);

    const res = await GET();
    const body = (await res.json()) as {
      exportedAt: string;
      version: number;
      eventSettings: unknown;
      vendors: unknown[];
      budgetItems: unknown[];
      payments: unknown[];
      assets: unknown[];
      incomes: unknown[];
      guests: unknown[];
      tasks: unknown[];
    };

    expect(body.version).toBe(2);
    expect(new Date(body.exportedAt).getTime()).toBeGreaterThan(0);
    expect(body.eventSettings).toEqual({ id: "singleton" });
    expect(body.vendors).toEqual([sample]);
    expect(body.budgetItems).toEqual([sample]);
    expect(body.payments).toEqual([sample]);
    expect(body.assets).toEqual([sample]);
    expect(body.incomes).toEqual([]);
    expect(body.guests).toEqual([]);
    expect(body.tasks).toEqual([]);
  });

  it("ordenação asc por createdAt nas coleções de auditoria", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    mockEmptyTables();

    await GET();
    expect(prismaMock.vendor.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
    expect(prismaMock.budgetItem.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
    expect(prismaMock.payment.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
    expect(prismaMock.asset.findMany).toHaveBeenCalledWith({ orderBy: { date: "asc" } });
  });
});

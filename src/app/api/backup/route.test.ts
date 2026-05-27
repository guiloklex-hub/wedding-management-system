import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

import { GET } from "./route";
import { BACKUP_VERSION, computeChecksum } from "@/lib/backup";

beforeEach(() => {
  authMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function mockEmptyTables() {
  prismaMock.eventSettings.findUnique.mockResolvedValue({ id: "singleton" } as never);
  prismaMock.securitySettings.findUnique.mockResolvedValue({ id: "singleton" } as never);
  prismaMock.user.findMany.mockResolvedValue([] as never);
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
  prismaMock.notificationLog.findMany.mockResolvedValue([] as never);
  prismaMock.auditLog.findMany.mockResolvedValue([] as never);
}

describe("GET /api/backup", () => {
  it("retorna 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("retorna 403 para role sem permissão financeira sensível", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "VIEWER" } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("retorna 200 com envelope { checksum, payload } e headers", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    mockEmptyTables();

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(res.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="wedding-finance-backup-\d{4}-\d{2}-\d{2}\.json"/,
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Backup-Version")).toBe(String(BACKUP_VERSION));
    expect(res.headers.get("X-Backup-Checksum")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("payload tem version 3, meta, checksum válido e coleções esperadas", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "admin@x", role: "ADMIN" } });
    const sample = { id: "v1" };
    mockEmptyTables();
    prismaMock.vendor.findMany.mockResolvedValue([sample] as never);
    prismaMock.budgetItem.findMany.mockResolvedValue([sample] as never);
    prismaMock.payment.findMany.mockResolvedValue([sample] as never);
    prismaMock.asset.findMany.mockResolvedValue([sample] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: "admin@x" },
    ] as never);

    const res = await GET();
    const body = (await res.json()) as {
      checksum: { algorithm: string; value: string };
      payload: Record<string, unknown> & { version: number; meta?: Record<string, unknown> };
    };

    expect(body.payload.version).toBe(BACKUP_VERSION);
    expect(body.checksum.algorithm).toBe("sha256");
    expect(body.checksum.value).toBe(computeChecksum(body.payload as never));
    expect(body.payload.meta).toBeDefined();
    expect((body.payload.meta as { appVersion?: string }).appVersion).toBeTruthy();
    expect(body.payload.users).toEqual([{ id: "u1", email: "admin@x" }]);
    expect(body.payload.vendors).toEqual([sample]);
  });

  it("não inclui users/auditLogs/notificationLogs para non-admin (GROOM/BRIDE)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "GROOM" } });
    mockEmptyTables();

    const res = await GET();
    const body = (await res.json()) as {
      payload: { users?: unknown; auditLogs?: unknown; notificationLogs?: unknown };
    };
    expect(body.payload.users).toBeUndefined();
    expect(body.payload.auditLogs).toBeUndefined();
    expect(body.payload.notificationLogs).toBeUndefined();
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });
});

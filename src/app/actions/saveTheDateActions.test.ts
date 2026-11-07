import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "test-user", role: "ADMIN" } })),
}));

vi.mock("@/lib/notifications/broadcast-worker", () => ({
  armBroadcastWorker: vi.fn(),
}));

import {
  cancelSaveTheDateBroadcast,
  resendFailedSaveTheDate,
  getSaveTheDateBroadcastProgress,
  getSaveTheDateBroadcastRecipients,
} from "./saveTheDateActions";

beforeEach(() => {
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

describe("saveTheDateActions — isolamento por kind", () => {
  it("cancelar não encontra broadcast de outro kind", async () => {
    prismaMock.broadcast.findFirst.mockResolvedValue(null);
    const res = await cancelSaveTheDateBroadcast("ann-1");
    expect(res.success).toBe(false);
    expect(prismaMock.broadcast.findFirst).toHaveBeenCalledWith({
      where: { id: "ann-1", kind: "SAVE_THE_DATE" },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("reenviar falhas não encontra broadcast de outro kind", async () => {
    prismaMock.broadcast.findFirst.mockResolvedValue(null);
    const res = await resendFailedSaveTheDate("ann-1");
    expect(res.success).toBe(false);
    expect(prismaMock.broadcastRecipient.updateMany).not.toHaveBeenCalled();
  });

  it("progresso filtra por kind", async () => {
    prismaMock.broadcast.findFirst.mockResolvedValue(null);
    const res = await getSaveTheDateBroadcastProgress("ann-1");
    expect(res).toBeNull();
    expect(prismaMock.broadcast.findFirst).toHaveBeenCalledWith({
      where: { id: "ann-1", kind: "SAVE_THE_DATE" },
    });
  });

  it("lista de destinatários filtra pelo kind do broadcast", async () => {
    prismaMock.broadcastRecipient.findMany.mockResolvedValue([]);
    await getSaveTheDateBroadcastRecipients("ann-1");
    expect(prismaMock.broadcastRecipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { broadcastId: "ann-1", broadcast: { kind: "SAVE_THE_DATE" } },
      }),
    );
  });
});

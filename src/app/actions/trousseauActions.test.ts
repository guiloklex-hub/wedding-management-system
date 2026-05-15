import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  createTrousseauItem,
  deleteTrousseauItem,
  setTrousseauStatus,
  updateTrousseauItem,
} from "./trousseauActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createTrousseauItem", () => {
  it("aplica defaults (room=OTHER, priority=NICE_TO_HAVE, status=TO_BUY)", async () => {
    prismaMock.trousseauItem.create.mockResolvedValue({} as never);
    const fd = new FormData();
    fd.set("title", "Liquidificador");
    const r = await createTrousseauItem(undefined, fd);
    expect(r.success).toBe(true);
    const data = (prismaMock.trousseauItem.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.room).toBe("OTHER");
    expect(data.priority).toBe("NICE_TO_HAVE");
    expect(data.status).toBe("TO_BUY");
  });

  it("rejeita título vazio", async () => {
    const fd = new FormData();
    fd.set("title", "  ");
    const r = await createTrousseauItem(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita room fora do enum", async () => {
    const fd = new FormData();
    fd.set("title", "X");
    fd.set("room", "GARAGE");
    const r = await createTrousseauItem(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("updateTrousseauItem", () => {
  it("retorna 'não encontrado' quando count===0", async () => {
    prismaMock.trousseauItem.updateMany.mockResolvedValue({ count: 0 } as never);
    const fd = new FormData();
    fd.set("id", "i1");
    fd.set("title", "X");
    const r = await updateTrousseauItem(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("setTrousseauStatus", () => {
  it("atualiza status", async () => {
    prismaMock.trousseauItem.updateMany.mockResolvedValue({ count: 1 } as never);
    const r = await setTrousseauStatus("i1", "BOUGHT");
    expect(r.success).toBe(true);
    expect(prismaMock.trousseauItem.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", deletedAt: null },
      data: { status: "BOUGHT" },
    });
  });

  it("erro quando count===0", async () => {
    prismaMock.trousseauItem.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await setTrousseauStatus("i1", "GIFTED");
    expect(r.success).toBe(false);
  });
});

describe("deleteTrousseauItem (soft delete)", () => {
  it("usa updateMany com deletedAt", async () => {
    prismaMock.trousseauItem.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteTrousseauItem("i1");
    expect(prismaMock.trousseauItem.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

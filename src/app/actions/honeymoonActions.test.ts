import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  createHoneymoonItem,
  deleteHoneymoonItem,
  ensureHoneymoon,
  updateHoneymoon,
  updateHoneymoonItem,
} from "./honeymoonActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.honeymoon.upsert.mockResolvedValue({ id: "singleton" } as never);
});

describe("ensureHoneymoon", () => {
  it("faz upsert no row 'singleton'", async () => {
    await ensureHoneymoon();
    expect(prismaMock.honeymoon.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
  });
});

describe("updateHoneymoon", () => {
  it("aceita destino e orçamento", async () => {
    prismaMock.honeymoon.update.mockResolvedValue({} as never);
    const fd = new FormData();
    fd.set("destination", "Maldivas");
    fd.set("budget", "25000");
    fd.set("currency", "BRL");
    const r = await updateHoneymoon(undefined, fd);
    expect(r.success).toBe(true);
    const data = (prismaMock.honeymoon.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.destination).toBe("Maldivas");
    expect(data.budget).toBe(25000);
  });

  it("rejeita currency fora do enum", async () => {
    const fd = new FormData();
    fd.set("currency", "GBP");
    const r = await updateHoneymoon(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("createHoneymoonItem", () => {
  it("cria item com defaults (kind=ACTIVITY, status=PLANNED)", async () => {
    prismaMock.honeymoonItem.create.mockResolvedValue({} as never);
    const fd = new FormData();
    fd.set("title", "Snorkeling");
    fd.set("currency", "BRL");
    const r = await createHoneymoonItem(undefined, fd);
    expect(r.success).toBe(true);
    const data = (prismaMock.honeymoonItem.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.kind).toBe("ACTIVITY");
    expect(data.status).toBe("PLANNED");
    expect(data.honeymoonId).toBe("singleton");
  });

  it("rejeita kind fora do enum", async () => {
    const fd = new FormData();
    fd.set("title", "X");
    fd.set("kind", "SPACESHIP");
    const r = await createHoneymoonItem(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita título vazio", async () => {
    const fd = new FormData();
    fd.set("title", "");
    const r = await createHoneymoonItem(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("updateHoneymoonItem", () => {
  it("retorna 'não encontrado' quando count===0", async () => {
    prismaMock.honeymoonItem.updateMany.mockResolvedValue({ count: 0 } as never);
    const fd = new FormData();
    fd.set("id", "i1");
    fd.set("title", "X");
    fd.set("currency", "BRL");
    const r = await updateHoneymoonItem(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("deleteHoneymoonItem", () => {
  it("usa soft delete escopado por deletedAt null", async () => {
    prismaMock.honeymoonItem.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteHoneymoonItem("i1");
    expect(prismaMock.honeymoonItem.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("erro quando count===0", async () => {
    prismaMock.honeymoonItem.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await deleteHoneymoonItem("i1");
    expect(r.success).toBe(false);
  });
});

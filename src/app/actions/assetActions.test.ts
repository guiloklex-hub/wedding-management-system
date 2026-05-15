import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import { createAsset, deleteAsset, updateAsset } from "./assetActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("title", "Aporte mensal");
  fd.set("amount", "1000");
  fd.set("date", "2026-05-15");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("createAsset", () => {
  it("rejeita amount zero", async () => {
    const r = await createAsset(undefined, form({ amount: "0" }));
    expect(r.success).toBe(false);
  });

  it("rejeita date fora do formato YYYY-MM-DD", async () => {
    const r = await createAsset(undefined, form({ date: "15/05/2026" }));
    expect(r.success).toBe(false);
  });

  it("rejeita título vazio", async () => {
    const r = await createAsset(undefined, form({ title: "  " }));
    expect(r.success).toBe(false);
  });

  it("converte goalId vazio para null", async () => {
    prismaMock.asset.create.mockResolvedValue({ id: "a1", amount: 1000 } as never);
    await createAsset(undefined, form({ goalId: "" }));
    const data = (prismaMock.asset.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.goalId).toBeNull();
  });

  it("aceita goalId quando informado", async () => {
    prismaMock.asset.create.mockResolvedValue({ id: "a1", amount: 1000 } as never);
    await createAsset(undefined, form({ goalId: "g1" }));
    const data = (prismaMock.asset.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.goalId).toBe("g1");
  });
});

describe("updateAsset", () => {
  it("erro quando count===0", async () => {
    prismaMock.asset.updateMany.mockResolvedValue({ count: 0 } as never);
    const fd = form({ id: "a1" });
    const r = await updateAsset(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("deleteAsset", () => {
  it("soft delete escopado por deletedAt null", async () => {
    prismaMock.asset.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteAsset("a1");
    expect(prismaMock.asset.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("erro quando não encontrado", async () => {
    prismaMock.asset.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await deleteAsset("a1");
    expect(r.success).toBe(false);
  });
});

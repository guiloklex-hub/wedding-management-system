import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import { createGoal, deleteGoal, updateGoal } from "./goalActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Reserva casamento");
  fd.set("targetAmount", "20000");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("createGoal", () => {
  it("isActive=false quando checkbox não vem no formulário", async () => {
    prismaMock.savingsGoal.create.mockResolvedValue({ id: "g1" } as never);
    await createGoal(undefined, form());
    const data = (prismaMock.savingsGoal.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.isActive).toBe(false);
  });

  it("converte checkbox 'on' para true", async () => {
    prismaMock.savingsGoal.create.mockResolvedValue({ id: "g1" } as never);
    await createGoal(undefined, form({ isActive: "on" }));
    const data = (prismaMock.savingsGoal.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.isActive).toBe(true);
  });

  it("rejeita targetAmount zero", async () => {
    const r = await createGoal(undefined, form({ targetAmount: "0" }));
    expect(r.success).toBe(false);
  });

  it("rejeita nome vazio", async () => {
    const r = await createGoal(undefined, form({ name: "" }));
    expect(r.success).toBe(false);
  });

  it("parseia targetDate quando informado", async () => {
    prismaMock.savingsGoal.create.mockResolvedValue({ id: "g1" } as never);
    await createGoal(undefined, form({ targetDate: "2026-12-01" }));
    const data = (prismaMock.savingsGoal.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.targetDate).toBeInstanceOf(Date);
  });
});

describe("updateGoal", () => {
  it("erro quando count===0", async () => {
    prismaMock.savingsGoal.updateMany.mockResolvedValue({ count: 0 } as never);
    const fd = form({ id: "g1" });
    const r = await updateGoal(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("deleteGoal", () => {
  it("soft delete + desvincula assets (goalId=null) em sucesso", async () => {
    prismaMock.savingsGoal.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.asset.updateMany.mockResolvedValue({ count: 3 } as never);

    const r = await deleteGoal("g1");
    expect(r.success).toBe(true);
    expect(prismaMock.savingsGoal.updateMany).toHaveBeenCalledWith({
      where: { id: "g1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prismaMock.asset.updateMany).toHaveBeenCalledWith({
      where: { goalId: "g1", deletedAt: null },
      data: { goalId: null },
    });
  });

  it("erro quando goal não existe (não toca em assets)", async () => {
    prismaMock.savingsGoal.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await deleteGoal("g1");
    expect(r.success).toBe(false);
    expect(prismaMock.asset.updateMany).not.toHaveBeenCalled();
  });
});

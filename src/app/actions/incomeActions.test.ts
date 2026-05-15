import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  createIncome,
  deleteIncome,
  markIncomeReceived,
  updateIncome,
} from "./incomeActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function incomeForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("title", "Salário");
  fd.set("amount", "5000");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("createIncome", () => {
  it("aplica defaults (source=SALARY, status=EXPECTED, frequency=ONE_TIME)", async () => {
    prismaMock.income.create.mockResolvedValue({ id: "i1", amount: 5000 } as never);
    const r = await createIncome(undefined, incomeForm());
    expect(r.success).toBe(true);
    const data = (prismaMock.income.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.source).toBe("SALARY");
    expect(data.status).toBe("EXPECTED");
    expect(data.frequency).toBe("ONE_TIME");
    expect(data.receivedAt).toBeNull();
  });

  it("seta receivedAt quando status=RECEIVED", async () => {
    prismaMock.income.create.mockResolvedValue({ id: "i1", amount: 5000 } as never);
    await createIncome(undefined, incomeForm({ status: "RECEIVED" }));
    const data = (prismaMock.income.create.mock.calls[0][0] as { data: { receivedAt: Date | null } }).data;
    expect(data.receivedAt).toBeInstanceOf(Date);
  });

  it("rejeita amount zero", async () => {
    const r = await createIncome(undefined, incomeForm({ amount: "0" }));
    expect(r.success).toBe(false);
  });

  it("rejeita source fora do enum", async () => {
    const r = await createIncome(undefined, incomeForm({ source: "INVESTMENT" }));
    expect(r.success).toBe(false);
  });
});

describe("updateIncome", () => {
  it("retorna 'não encontrada' quando não acha", async () => {
    prismaMock.income.findFirst.mockResolvedValue(null);
    const fd = incomeForm({ id: "i1" });
    const r = await updateIncome(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("preserva receivedAt original quando já está RECEIVED", async () => {
    const original = new Date("2026-01-01T00:00:00Z");
    prismaMock.income.findFirst.mockResolvedValue({
      id: "i1",
      receivedAt: original,
    } as never);
    prismaMock.income.update.mockResolvedValue({} as never);

    const fd = incomeForm({ id: "i1", status: "RECEIVED" });
    await updateIncome(undefined, fd);

    const data = (prismaMock.income.update.mock.calls[0][0] as { data: { receivedAt: Date | null } }).data;
    expect(data.receivedAt?.getTime()).toBe(original.getTime());
  });

  it("zera receivedAt quando volta para EXPECTED", async () => {
    prismaMock.income.findFirst.mockResolvedValue({
      id: "i1",
      receivedAt: new Date(),
    } as never);
    prismaMock.income.update.mockResolvedValue({} as never);

    const fd = incomeForm({ id: "i1", status: "EXPECTED" });
    await updateIncome(undefined, fd);

    const data = (prismaMock.income.update.mock.calls[0][0] as { data: { receivedAt: Date | null } }).data;
    expect(data.receivedAt).toBeNull();
  });
});

describe("markIncomeReceived", () => {
  it("seta status=RECEIVED + receivedAt", async () => {
    prismaMock.income.updateMany.mockResolvedValue({ count: 1 } as never);
    await markIncomeReceived("i1");
    const data = (prismaMock.income.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe("RECEIVED");
    expect(data.receivedAt).toBeInstanceOf(Date);
  });

  it("erro quando count===0", async () => {
    prismaMock.income.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await markIncomeReceived("i1");
    expect(r.success).toBe(false);
  });
});

describe("deleteIncome", () => {
  it("soft delete", async () => {
    prismaMock.income.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteIncome("i1");
    expect(prismaMock.income.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

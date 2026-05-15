import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  createContract,
  deleteContract,
  updateContract,
} from "./contractActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function contractForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("vendorId", "v1");
  fd.set("title", "Contrato Buffet");
  fd.set("status", "DRAFT");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("createContract", () => {
  it("calcula version = existingCount + 1", async () => {
    prismaMock.contract.count.mockResolvedValue(2);
    prismaMock.contract.create.mockResolvedValue({ id: "c3" } as never);

    const r = await createContract(undefined, contractForm());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data?.id).toBe("c3");
    const data = (prismaMock.contract.create.mock.calls[0][0] as { data: { version: number } }).data;
    expect(data.version).toBe(3);
  });

  it("primeira versão é 1", async () => {
    prismaMock.contract.count.mockResolvedValue(0);
    prismaMock.contract.create.mockResolvedValue({ id: "c1" } as never);

    await createContract(undefined, contractForm());
    const data = (prismaMock.contract.create.mock.calls[0][0] as { data: { version: number } }).data;
    expect(data.version).toBe(1);
  });

  it("rejeita status fora do enum", async () => {
    const r = await createContract(undefined, contractForm({ status: "FOOBAR" }));
    expect(r.success).toBe(false);
  });

  it("rejeita título vazio", async () => {
    const r = await createContract(undefined, contractForm({ title: "" }));
    expect(r.success).toBe(false);
  });
});

describe("updateContract", () => {
  it("escopado por vendorId + id + deletedAt null", async () => {
    prismaMock.contract.updateMany.mockResolvedValue({ count: 1 } as never);
    const fd = contractForm({ id: "c1" });
    await updateContract(undefined, fd);
    expect(prismaMock.contract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1", vendorId: "v1", deletedAt: null },
      }),
    );
  });

  it("retorna 'não encontrado' quando count===0", async () => {
    prismaMock.contract.updateMany.mockResolvedValue({ count: 0 } as never);
    const fd = contractForm({ id: "c1" });
    const r = await updateContract(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("deleteContract", () => {
  it("escopado por vendorId no soft delete", async () => {
    prismaMock.contract.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteContract("c1", "v1");
    expect(prismaMock.contract.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", vendorId: "v1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

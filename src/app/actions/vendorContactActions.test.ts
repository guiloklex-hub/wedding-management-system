import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  createVendorContact,
  deleteVendorContact,
  updateVendorContact,
} from "./vendorContactActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("vendorId", "v1");
  fd.set("name", "João Contato");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

function setupTransaction() {
  prismaMock.$transaction.mockImplementation(async (fnOrArr) => {
    if (typeof fnOrArr === "function") {
      return fnOrArr(prismaMock as never);
    }
    return [];
  });
}

describe("createVendorContact", () => {
  it("rejeita vendorId ausente", async () => {
    const r = await createVendorContact(undefined, new FormData());
    expect(r.success).toBe(false);
  });

  it("rejeita nome vazio", async () => {
    const r = await createVendorContact(undefined, form({ name: "" }));
    expect(r.success).toBe(false);
  });

  it("normaliza email para lowercase", async () => {
    setupTransaction();
    prismaMock.vendorContact.create.mockResolvedValue({ id: "c1" } as never);

    await createVendorContact(undefined, form({ email: "  FOO@BAR.COM " }));
    const data = (prismaMock.vendorContact.create.mock.calls[0][0] as { data: { email: string | null } }).data;
    expect(data.email).toBe("foo@bar.com");
  });

  it("quando isPrimary=on, desmarca outros isPrimary do mesmo vendor", async () => {
    setupTransaction();
    prismaMock.vendorContact.create.mockResolvedValue({ id: "c1" } as never);
    prismaMock.vendorContact.updateMany.mockResolvedValue({ count: 1 } as never);

    await createVendorContact(undefined, form({ isPrimary: "on" }));

    expect(prismaMock.vendorContact.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendorId: "v1",
          isPrimary: true,
          deletedAt: null,
        }),
        data: { isPrimary: false },
      }),
    );
  });

  it("não desmarca outros quando isPrimary=off", async () => {
    setupTransaction();
    prismaMock.vendorContact.create.mockResolvedValue({ id: "c1" } as never);

    await createVendorContact(undefined, form({ isPrimary: "" }));

    expect(prismaMock.vendorContact.updateMany).not.toHaveBeenCalled();
  });
});

describe("updateVendorContact", () => {
  it("isPrimary=true exclui o próprio id ao desmarcar outros (NOT id)", async () => {
    setupTransaction();
    prismaMock.vendorContact.updateMany.mockResolvedValue({ count: 1 } as never);

    await updateVendorContact(undefined, form({ id: "c1", isPrimary: "on" }));

    const call = (prismaMock.vendorContact.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    });
    expect(call.where.NOT).toEqual({ id: "c1" });
  });
});

describe("deleteVendorContact (soft delete)", () => {
  it("escopado por vendorId", async () => {
    prismaMock.vendorContact.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteVendorContact("c1", "v1");
    expect(prismaMock.vendorContact.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", vendorId: "v1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("erro quando não encontrado", async () => {
    prismaMock.vendorContact.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await deleteVendorContact("c1", "v1");
    expect(r.success).toBe(false);
  });
});

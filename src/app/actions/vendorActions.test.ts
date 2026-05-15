import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  createVendor,
  deleteVendor,
  updateVendor,
  updateVendorStatus,
} from "./vendorActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function vendorForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Buffet X");
  fd.set("category", "Buffet");
  fd.set("status", "NEGOTIATION");
  fd.set("estimatedValue", "5000");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("createVendor", () => {
  it("usa $transaction para criar vendor + budgetItem", async () => {
    prismaMock.$transaction.mockResolvedValue({ id: "v1", name: "Buffet X", status: "NEGOTIATION" } as never);

    const r = await createVendor(undefined, vendorForm());
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("rejeita nome vazio", async () => {
    const r = await createVendor(undefined, vendorForm({ name: "" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/nome|inválidos/i);
  });

  it("rejeita estimatedValue negativo", async () => {
    const r = await createVendor(undefined, vendorForm({ estimatedValue: "-1" }));
    expect(r.success).toBe(false);
  });

  it("rejeita status fora do enum", async () => {
    const r = await createVendor(undefined, vendorForm({ status: "DONE" }));
    expect(r.success).toBe(false);
  });
});

describe("updateVendor", () => {
  it("rejeita id ausente", async () => {
    const r = await updateVendor(undefined, vendorForm());
    expect(r.success).toBe(false);
  });

  it("invoca $transaction quando válido", async () => {
    prismaMock.$transaction.mockResolvedValue(undefined as never);
    const r = await updateVendor(undefined, vendorForm({ id: "v1" }));
    expect(r.success).toBe(true);
  });
});

describe("updateVendorStatus", () => {
  it("chama $transaction com status novo", async () => {
    prismaMock.$transaction.mockResolvedValue(undefined as never);
    const r = await updateVendorStatus("v1", "CONTRACTED", 5000);
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe("deleteVendor (soft delete em cascata)", () => {
  it("usa $transaction para soft-delete vendor + budgetItems + payments", async () => {
    prismaMock.$transaction.mockResolvedValue(undefined as never);
    const r = await deleteVendor("v1");
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("retorna erro quando $transaction falha", async () => {
    prismaMock.$transaction.mockRejectedValue(new Error("db down"));
    const r = await deleteVendor("v1");
    expect(r.success).toBe(false);
  });
});

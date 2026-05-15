import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  createPayment,
  createSplitPayment,
  deletePayment,
  markPaymentAsPaid,
  undoPaymentPaid,
  updatePayment,
} from "./paymentActions";

const eventDateFar = new Date("2030-01-01T00:00:00Z");

function withConfig() {
  prismaMock.eventSettings.upsert.mockResolvedValue({
    id: "singleton",
    eventDate: eventDateFar,
    contingencyPercent: 10,
    currency: "BRL",
    coupleNames: null,
  } as never);
}

function basePaymentForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("amount", "100");
  fd.set("dueDate", "2026-12-01");
  fd.set("status", "PENDING");
  fd.set("method", "PIX");
  fd.set("vendorId", "v1");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  withConfig();
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

describe("createPayment - validações Zod", () => {
  it("rejeita quando installmentNumber > totalInstallments", async () => {
    const fd = basePaymentForm({ installmentNumber: "3", totalInstallments: "2" });
    const r = await createPayment(undefined, fd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/parcela atual/i);
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it("aceita installmentNumber === totalInstallments", async () => {
    prismaMock.vendor.findFirst.mockResolvedValue({ id: "v1" } as never);
    prismaMock.payment.create.mockResolvedValue({ id: "p1" } as never);
    const fd = basePaymentForm({ installmentNumber: "2", totalInstallments: "2" });
    const r = await createPayment(undefined, fd);
    expect(r.success).toBe(true);
  });

  it("rejeita amount zero", async () => {
    const fd = basePaymentForm({ amount: "0" });
    const r = await createPayment(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita dueDate fora do formato YYYY-MM-DD", async () => {
    const fd = basePaymentForm({ dueDate: "01/12/2026" });
    const r = await createPayment(undefined, fd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/data inválida/i);
  });

  it("rejeita method fora do enum", async () => {
    const fd = basePaymentForm({ method: "BITCOIN" });
    const r = await createPayment(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita installmentNumber abaixo de 1", async () => {
    const fd = basePaymentForm({ installmentNumber: "0", totalInstallments: "2" });
    const r = await createPayment(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("createPayment - regras de data x evento", () => {
  it("bloqueia PIX após a data do evento", async () => {
    prismaMock.eventSettings.upsert.mockResolvedValue({
      id: "singleton",
      eventDate: new Date("2026-01-01T00:00:00Z"),
      contingencyPercent: 10,
      currency: "BRL",
      coupleNames: null,
    } as never);
    const fd = basePaymentForm({ dueDate: "2026-12-01", method: "PIX" });
    const r = await createPayment(undefined, fd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/posteriores à data do evento/i);
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it("permite CREDIT após a data do evento (parcelamento)", async () => {
    prismaMock.eventSettings.upsert.mockResolvedValue({
      id: "singleton",
      eventDate: new Date("2026-01-01T00:00:00Z"),
      contingencyPercent: 10,
      currency: "BRL",
      coupleNames: null,
    } as never);
    prismaMock.vendor.findFirst.mockResolvedValue({ id: "v1" } as never);
    prismaMock.payment.create.mockResolvedValue({ id: "p1" } as never);
    const fd = basePaymentForm({ dueDate: "2026-12-01", method: "CREDIT" });
    const r = await createPayment(undefined, fd);
    expect(r.success).toBe(true);
  });
});

describe("createPayment - dependências", () => {
  it("retorna erro quando vendor não existe", async () => {
    prismaMock.vendor.findFirst.mockResolvedValue(null);
    const r = await createPayment(undefined, basePaymentForm());
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/fornecedor/i);
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it("seta paidAt quando status=PAID", async () => {
    prismaMock.vendor.findFirst.mockResolvedValue({ id: "v1" } as never);
    prismaMock.payment.create.mockResolvedValue({ id: "p1" } as never);

    await createPayment(undefined, basePaymentForm({ status: "PAID" }));

    const [[call]] = prismaMock.payment.create.mock.calls;
    expect((call as { data: { paidAt: Date | null } }).data.paidAt).toBeInstanceOf(Date);
  });
});

describe("updatePayment", () => {
  it("rejeita parcela maior que total", async () => {
    const fd = basePaymentForm({
      installmentNumber: "5",
      totalInstallments: "3",
    });
    fd.set("id", "p1");
    const r = await updatePayment(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("retorna erro quando payment não existe", async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);
    const fd = basePaymentForm();
    fd.set("id", "p1");
    const r = await updatePayment(undefined, fd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/não encontrado/i);
  });
});

describe("markPaymentAsPaid", () => {
  it("retorna erro quando updateMany count===0", async () => {
    prismaMock.payment.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await markPaymentAsPaid("p1");
    expect(r.success).toBe(false);
  });

  it("sucesso quando atualiza 1", async () => {
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 } as never);
    const r = await markPaymentAsPaid("p1");
    expect(r.success).toBe(true);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", deletedAt: null, status: "PENDING" },
      data: { status: "PAID", paidAt: expect.any(Date) },
    });
  });
});

describe("undoPaymentPaid", () => {
  it("só estorna se status=PAID (count===0 em PENDING)", async () => {
    prismaMock.payment.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await undoPaymentPaid("p1");
    expect(r.success).toBe(false);
  });

  it("estorna com sucesso", async () => {
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 } as never);
    const r = await undoPaymentPaid("p1");
    expect(r.success).toBe(true);
  });
});

describe("deletePayment", () => {
  it("soft delete bem-sucedido", async () => {
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 } as never);
    const r = await deletePayment("p1");
    expect(r.success).toBe(true);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("retorna erro quando não encontrado", async () => {
    prismaMock.payment.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await deletePayment("p1");
    expect(r.success).toBe(false);
  });
});

describe("createSplitPayment", () => {
  function splitForm(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("depositAmount", "300");
    fd.set("depositMethod", "PIX");
    fd.set("finalAmount", "700");
    fd.set("finalDueDate", "2027-12-01");
    fd.set("finalMethod", "PIX");
    fd.set("vendorId", "v1");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("cria dois pagamentos dentro de $transaction", async () => {
    prismaMock.vendor.findFirst.mockResolvedValue({ id: "v1" } as never);
    prismaMock.$transaction.mockResolvedValue([
      { id: "p1" },
      { id: "p2" },
    ] as never);

    const r = await createSplitPayment(undefined, splitForm());
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("bloqueia quando vendor não existe", async () => {
    prismaMock.vendor.findFirst.mockResolvedValue(null);
    const r = await createSplitPayment(undefined, splitForm());
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita finalDueDate posterior ao evento (PIX)", async () => {
    prismaMock.eventSettings.upsert.mockResolvedValue({
      id: "singleton",
      eventDate: new Date("2026-01-01T00:00:00Z"),
      contingencyPercent: 10,
      currency: "BRL",
      coupleNames: null,
    } as never);
    const r = await createSplitPayment(undefined, splitForm({ finalDueDate: "2027-12-01" }));
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

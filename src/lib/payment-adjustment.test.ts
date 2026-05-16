import { describe, expect, it } from "vitest";
import { computeAdjustedAmount } from "./payment-adjustment";

describe("computeAdjustedAmount", () => {
  it("retorna valor original quando não está em atraso", () => {
    const result = computeAdjustedAmount(
      {
        amount: 1000,
        dueDate: new Date("2026-06-01T00:00:00Z"),
        paidAt: null,
        status: "PENDING",
        lateFeePercent: 2,
        interestPercentPerMonth: 1,
      },
      new Date("2026-05-15T00:00:00Z"),
    );
    expect(result.adjusted).toBe(1000);
    expect(result.hasAdjustment).toBe(false);
    expect(result.lateDays).toBe(0);
  });

  it("retorna valor original quando já está pago, mesmo após dueDate", () => {
    const result = computeAdjustedAmount(
      {
        amount: 1000,
        dueDate: new Date("2026-05-01T00:00:00Z"),
        paidAt: new Date("2026-05-02T00:00:00Z"),
        status: "PAID",
        lateFeePercent: 2,
        interestPercentPerMonth: 1,
      },
      new Date("2026-06-01T00:00:00Z"),
    );
    expect(result.adjusted).toBe(1000);
    expect(result.hasAdjustment).toBe(false);
  });

  it("aplica multa fixa quando atrasado e há lateFeePercent", () => {
    const result = computeAdjustedAmount(
      {
        amount: 1000,
        dueDate: new Date("2026-05-01T00:00:00Z"),
        paidAt: null,
        status: "PENDING",
        lateFeePercent: 2,
        interestPercentPerMonth: 0,
      },
      new Date("2026-05-15T00:00:00Z"),
    );
    expect(result.lateFee).toBe(20); // 2% de 1000
    expect(result.interest).toBe(0);
    expect(result.adjusted).toBe(1020);
    expect(result.hasAdjustment).toBe(true);
  });

  it("aplica juros proporcionais ao número de dias atrasados", () => {
    // 30 dias de atraso, 1% ao mês = 1% = R$10
    const result = computeAdjustedAmount(
      {
        amount: 1000,
        dueDate: new Date("2026-04-15T00:00:00Z"),
        paidAt: null,
        status: "PENDING",
        lateFeePercent: 0,
        interestPercentPerMonth: 1,
      },
      new Date("2026-05-15T00:00:00Z"),
    );
    expect(result.lateDays).toBe(30);
    expect(result.interest).toBe(10);
    expect(result.adjusted).toBe(1010);
  });

  it("combina multa e juros proporcionais (15 dias)", () => {
    const result = computeAdjustedAmount(
      {
        amount: 1000,
        dueDate: new Date("2026-04-30T00:00:00Z"),
        paidAt: null,
        status: "PENDING",
        lateFeePercent: 2,
        interestPercentPerMonth: 1,
      },
      new Date("2026-05-15T00:00:00Z"),
    );
    // 2% multa = 20, juros 1%/mês x 15/30 = 5
    expect(result.lateFee).toBe(20);
    expect(result.interest).toBe(5);
    expect(result.adjusted).toBe(1025);
  });

  it("retorna lateDays mas sem ajuste quando taxas são zero", () => {
    const result = computeAdjustedAmount(
      {
        amount: 500,
        dueDate: new Date("2026-04-15T00:00:00Z"),
        paidAt: null,
        status: "PENDING",
        lateFeePercent: null,
        interestPercentPerMonth: null,
      },
      new Date("2026-05-15T00:00:00Z"),
    );
    expect(result.lateDays).toBe(30);
    expect(result.adjusted).toBe(500);
    expect(result.hasAdjustment).toBe(false);
  });
});

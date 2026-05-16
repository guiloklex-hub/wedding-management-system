import { describe, it, expect } from "vitest";
import { buildPaymentSCurve } from "./payment-curve";

describe("buildPaymentSCurve", () => {
  it("retorna [] para lista vazia", () => {
    expect(buildPaymentSCurve([], 10)).toEqual([]);
  });

  it("acumula previsto e realizado em ordem cronológica", () => {
    const r = buildPaymentSCurve(
      [
        { amount: 100, dueDate: new Date("2026-01-01"), paidAt: new Date("2026-01-05"), status: "PAID" },
        { amount: 200, dueDate: new Date("2026-02-01"), paidAt: null, status: "PENDING" },
      ],
      10,
    );
    const last = r[r.length - 1];
    expect(last.plannedCum).toBe(300);
    expect(last.paidCum).toBe(100);
  });

  it("aplica banda de contingência", () => {
    const r = buildPaymentSCurve(
      [
        { amount: 100, dueDate: new Date("2026-01-01"), paidAt: null, status: "PENDING" },
      ],
      10,
    );
    expect(r[0].upperBand).toBeCloseTo(110, 6);
    expect(r[0].lowerBand).toBeCloseTo(90, 6);
  });
});

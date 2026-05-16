import { describe, it, expect } from "vitest";
import { buildVendorFunnel } from "./vendor-funnel";

const fakeLabel = (_k: string | null, fb: string) => fb;

describe("buildVendorFunnel", () => {
  it("conta vendors por status", () => {
    const r = buildVendorFunnel(
      [
        {
          status: "NEGOTIATION",
          categoryKey: "BUFFET",
          category: "Buffet",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          contracts: [],
        },
        {
          status: "CONTRACTED",
          categoryKey: "BUFFET",
          category: "Buffet",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-02-01"),
          contracts: [{ signedAt: new Date("2026-01-15"), createdAt: new Date("2026-01-10") }],
        },
        {
          status: "FINALIZED",
          categoryKey: "PHOTO_VIDEO",
          category: "Foto",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-03-01"),
          contracts: [{ signedAt: new Date("2026-01-15"), createdAt: new Date("2026-01-10") }],
        },
      ],
      fakeLabel,
    );
    expect(r.totals).toEqual({ NEGOTIATION: 1, CONTRACTED: 1, FINALIZED: 1 });
    expect(r.perCategory).toHaveLength(2);
  });

  it("calcula tempo médio neg->contract", () => {
    const r = buildVendorFunnel(
      [
        {
          status: "CONTRACTED",
          categoryKey: "BUFFET",
          category: "Buffet",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-02-01"),
          contracts: [{ signedAt: new Date("2026-01-11"), createdAt: new Date("2026-01-01") }],
        },
      ],
      fakeLabel,
    );
    expect(r.avgDaysNegToContract).toBe(10);
  });

  it("retorna null quando não há contratos", () => {
    const r = buildVendorFunnel(
      [
        {
          status: "NEGOTIATION",
          categoryKey: null,
          category: "Outros",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          contracts: [],
        },
      ],
      fakeLabel,
    );
    expect(r.avgDaysNegToContract).toBeNull();
  });
});

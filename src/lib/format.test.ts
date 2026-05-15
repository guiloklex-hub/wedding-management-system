import { describe, it, expect } from "vitest";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateBR,
  toIsoDate,
} from "./format";

describe("formatCurrency", () => {
  it("formata em BRL com duas casas decimais", () => {
    const out = formatCurrency(1234.5);
    expect(out).toMatch(/R\$/);
    expect(out).toMatch(/1\.234,50/);
  });

  it("formata 0 corretamente", () => {
    expect(formatCurrency(0)).toMatch(/0,00/);
  });

  it("usa a moeda recebida", () => {
    const out = formatCurrency(10, "USD");
    expect(out).toMatch(/US\$|USD/);
  });
});

describe("formatCompactCurrency", () => {
  it("formata em notação compacta acima de mil", () => {
    const out = formatCompactCurrency(15_000);
    expect(out).toMatch(/15\s*mil|15,0\s*mil/);
  });

  it("usa formato cheio abaixo de mil", () => {
    expect(formatCompactCurrency(500)).toMatch(/500,00/);
  });
});

describe("formatDateBR", () => {
  it("formata uma Date em pt-BR (UTC)", () => {
    const d = new Date(Date.UTC(2026, 10, 15));
    expect(formatDateBR(d)).toBe("15/11/2026");
  });

  it("aceita string ISO", () => {
    expect(formatDateBR("2026-11-15T00:00:00Z")).toBe("15/11/2026");
  });
});

describe("toIsoDate", () => {
  it("retorna YYYY-MM-DD", () => {
    const d = new Date(Date.UTC(2026, 10, 15, 23, 59, 59));
    expect(toIsoDate(d)).toBe("2026-11-15");
  });
});

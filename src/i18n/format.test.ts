import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, formatDateTime, formatCompactCurrency, toIsoDate } from "./format";

describe("formatCurrency", () => {
  it("formata BRL em pt-BR", () => {
    const out = formatCurrency(1234.5, "BRL", "pt-BR");
    expect(out).toMatch(/R\$/);
    expect(out).toMatch(/1\.234,50/);
  });

  it("formata USD em inglês", () => {
    const out = formatCurrency(1234.5, "USD", "en");
    expect(out).toMatch(/\$/);
    expect(out).toMatch(/1,234\.50/);
  });

  it("formata EUR em espanhol", () => {
    const out = formatCurrency(1234.5, "EUR", "es");
    expect(out).toMatch(/€/);
    expect(out).toMatch(/1234,50|1\.234,50/);
  });

  it("formato compacto", () => {
    const out = formatCompactCurrency(15000, "BRL", "pt-BR");
    expect(out).toMatch(/15/);
  });
});

describe("formatDate", () => {
  it("formata pt-BR no fuso de São Paulo por default", () => {
    const out = formatDate(new Date("2026-12-31T22:00:00Z"), "pt-BR");
    expect(out).toMatch(/31\/12\/2026/);
  });

  it("formata en em UTC por default", () => {
    const out = formatDate(new Date("2026-01-15T12:00:00Z"), "en");
    expect(out).toMatch(/1\/15\/2026/);
  });

  it("formata es em UTC por default", () => {
    const out = formatDate(new Date("2026-01-15T12:00:00Z"), "es");
    expect(out).toMatch(/15\/1\/2026/);
  });

  it("aceita opções dateStyle long", () => {
    const out = formatDate(new Date("2026-06-15T12:00:00Z"), "en", { dateStyle: "long" });
    expect(out).toMatch(/June/);
    expect(out).toMatch(/2026/);
  });
});

describe("formatDateTime", () => {
  it("inclui hora e minuto", () => {
    const out = formatDateTime(new Date("2026-06-15T14:30:00Z"), "en", { timeZone: "UTC" });
    expect(out).toMatch(/14:30|2:30/);
  });
});

describe("toIsoDate", () => {
  it("retorna YYYY-MM-DD", () => {
    expect(toIsoDate(new Date("2026-06-15T12:00:00Z"))).toBe("2026-06-15");
  });
  it("retorna vazio para null", () => {
    expect(toIsoDate(null)).toBe("");
  });
});

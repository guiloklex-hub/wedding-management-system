import { describe, expect, it } from "vitest";
import { generateBrCode } from "./pix";

describe("generateBrCode", () => {
  it("gera string com header EMV correto", () => {
    const code = generateBrCode({
      key: "noivos@example.com",
      merchantName: "Casamento",
      merchantCity: "Curitiba",
    });
    expect(code.startsWith("000201")).toBe(true);
    expect(code).toContain("br.gov.bcb.pix");
    expect(code).toContain("noivos@example.com");
  });

  it("inclui valor opcional formatado com duas decimais", () => {
    const code = generateBrCode({
      key: "+5511999999999",
      merchantName: "Joao e Maria",
      merchantCity: "Sao Paulo",
      amount: 150,
    });
    expect(code).toContain("5406150.00");
  });

  it("omite tag de valor quando amount é undefined", () => {
    const code = generateBrCode({
      key: "key123",
      merchantName: "Test",
      merchantCity: "City",
    });
    expect(code).not.toMatch(/54\d{2}\d+\.\d{2}/);
  });

  it("termina com CRC16 de 4 hex maiúsculos", () => {
    const code = generateBrCode({
      key: "key",
      merchantName: "Noivos",
      merchantCity: "BSB",
    });
    const tail = code.slice(-8);
    expect(tail.startsWith("6304")).toBe(true);
    expect(tail.slice(4)).toMatch(/^[0-9A-F]{4}$/);
  });

  it("sanitiza acentos no nome para ASCII", () => {
    const code = generateBrCode({
      key: "key",
      merchantName: "Joao & Marília",
      merchantCity: "São Paulo",
    });
    expect(code).not.toMatch(/[ãáâéíóúç]/i);
    expect(code).toContain("Sao Paulo");
  });

  it("rejeita chave vazia", () => {
    expect(() =>
      generateBrCode({ key: "", merchantName: "X", merchantCity: "Y" }),
    ).toThrow();
  });

  it("rejeita nome vazio após sanitização", () => {
    expect(() =>
      generateBrCode({ key: "k", merchantName: "", merchantCity: "Y" }),
    ).toThrow();
  });

  it("trunca txid para 25 alphanumeric chars", () => {
    const code = generateBrCode({
      key: "k",
      merchantName: "M",
      merchantCity: "C",
      txid: "abc-def_123/456/789/extra-stuff!@#",
    });
    expect(code).toContain("abcdef123456789extrastuff");
  });
});

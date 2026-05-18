import { describe, it, expect } from "vitest";
import {
  LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  coerceLocale,
  parseAcceptLanguage,
} from "./config";

describe("LOCALES", () => {
  it("inclui pt-BR, en e es", () => {
    expect(LOCALES).toEqual(["pt-BR", "en", "es"]);
  });
  it("DEFAULT_LOCALE é pt-BR", () => {
    expect(DEFAULT_LOCALE).toBe("pt-BR");
  });
});

describe("isLocale", () => {
  it.each(["pt-BR", "en", "es"])("aceita %s", (l) => {
    expect(isLocale(l)).toBe(true);
  });
  it("rejeita strings inválidas", () => {
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("pt")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe("coerceLocale", () => {
  it("preserva válidos", () => {
    expect(coerceLocale("en")).toBe("en");
  });
  it("retorna default para inválidos", () => {
    expect(coerceLocale("zz")).toBe("pt-BR");
    expect(coerceLocale(null)).toBe("pt-BR");
  });
});

describe("parseAcceptLanguage", () => {
  it("retorna null para header vazio", () => {
    expect(parseAcceptLanguage(null)).toBeNull();
    expect(parseAcceptLanguage("")).toBeNull();
  });
  it("identifica en", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });
  it("identifica es", () => {
    expect(parseAcceptLanguage("es-ES,es;q=0.9")).toBe("es");
  });
  it("identifica pt como pt-BR", () => {
    expect(parseAcceptLanguage("pt-BR,pt;q=0.9")).toBe("pt-BR");
    expect(parseAcceptLanguage("pt-PT")).toBe("pt-BR");
  });
  it("respeita ordem de q-values", () => {
    expect(parseAcceptLanguage("fr;q=0.9,en;q=0.5")).toBe("en");
  });
  it("retorna null para idiomas não suportados", () => {
    expect(parseAcceptLanguage("fr,de,it")).toBeNull();
  });
});

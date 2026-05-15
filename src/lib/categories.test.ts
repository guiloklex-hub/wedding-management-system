import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  CATEGORY_MAP,
  getCategory,
  resolveCategoryColor,
  resolveCategoryLabel,
} from "./categories";

describe("CATEGORIES", () => {
  it("não tem keys duplicadas", () => {
    const keys = CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("CATEGORY_MAP cobre todas as categorias", () => {
    expect(CATEGORY_MAP.size).toBe(CATEGORIES.length);
  });

  it("todas têm cor hex válida", () => {
    for (const c of CATEGORIES) {
      expect(c.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("getCategory", () => {
  it("retorna o def quando a key existe", () => {
    expect(getCategory("VENUE")?.label).toBe("Local / Espaço");
  });

  it("retorna null para key inválida", () => {
    expect(getCategory("FOO" as unknown as string)).toBeNull();
  });

  it("retorna null para null/undefined", () => {
    expect(getCategory(null)).toBeNull();
    expect(getCategory(undefined)).toBeNull();
    expect(getCategory("")).toBeNull();
  });
});

describe("resolveCategoryLabel", () => {
  it("retorna o label da categoria quando key existe", () => {
    expect(resolveCategoryLabel("BUFFET", "fallback")).toBe("Buffet / Comida");
  });

  it("retorna fallback quando key não existe", () => {
    expect(resolveCategoryLabel("INEXISTENTE", "Custom")).toBe("Custom");
    expect(resolveCategoryLabel(null, "Custom")).toBe("Custom");
  });
});

describe("resolveCategoryColor", () => {
  it("retorna a cor da categoria", () => {
    expect(resolveCategoryColor("VENUE")).toBe("#a78bfa");
  });

  it("retorna cor padrão (zinc) quando não há categoria", () => {
    expect(resolveCategoryColor(null)).toBe("#71717a");
    expect(resolveCategoryColor("INEXISTENTE")).toBe("#71717a");
  });
});

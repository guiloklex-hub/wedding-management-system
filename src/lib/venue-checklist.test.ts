import { describe, it, expect } from "vitest";
import { DEFAULT_VENUE_CHECKLIST } from "./venue-checklist";

describe("DEFAULT_VENUE_CHECKLIST", () => {
  it("tem itens", () => {
    expect(DEFAULT_VENUE_CHECKLIST.length).toBeGreaterThan(0);
  });

  it("não tem itens duplicados", () => {
    const set = new Set(DEFAULT_VENUE_CHECKLIST);
    expect(set.size).toBe(DEFAULT_VENUE_CHECKLIST.length);
  });

  it("nenhum item é vazio", () => {
    for (const item of DEFAULT_VENUE_CHECKLIST) {
      expect(item.trim().length).toBeGreaterThan(0);
    }
  });

  it("cobre tópicos críticos (estacionamento, banheiros, chuva)", () => {
    const joined = DEFAULT_VENUE_CHECKLIST.join(" ").toLowerCase();
    expect(joined).toContain("estacionamento");
    expect(joined).toContain("banheiros");
    expect(joined).toContain("chuva");
  });
});

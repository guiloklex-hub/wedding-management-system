import { describe, it, expect } from "vitest";
import { buildInsightsNarrativePrompt, type InsightsNarrativeInput } from "./prompts";

const base: InsightsNarrativeInput = {
  locale: "pt-BR",
  coupleNames: "Ana & Beto",
  daysToEvent: 120,
  healthScore: 72,
  money: {
    budget: "R$ 100,00",
    contracted: "R$ 70,00",
    paid: "R$ 40,00",
    cash: "R$ 35,00",
    leftover: "R$ 5,00",
    worstMonthlyBalance: "-R$ 2,00",
  },
  breakdown: [{ label: "Cobertura contratada", pct: 0.7 }],
  alerts: ["Você está atrasado em fechar fornecedores."],
  topCreep: [{ category: "Buffet", deltaLabel: "R$ 10,00", pct: 0.2 }],
};

describe("buildInsightsNarrativePrompt", () => {
  it("delimita os dados do usuário e embute os números", () => {
    const { system, user } = buildInsightsNarrativePrompt(base);
    expect(system).toContain("português do Brasil");
    expect(user).toContain("<dados>");
    expect(user).toContain("</dados>");
    expect(user).toContain("Ana & Beto");
    expect(user).toContain("R$ 70,00");
    expect(user).toContain("Buffet");
  });

  it("mapeia o locale para o nome do idioma", () => {
    expect(buildInsightsNarrativePrompt({ ...base, locale: "en" }).system).toContain("English");
    expect(buildInsightsNarrativePrompt({ ...base, locale: "es" }).system).toContain("español");
  });

  it("cai para pt-BR em locale desconhecido", () => {
    expect(buildInsightsNarrativePrompt({ ...base, locale: "xx" }).system).toContain(
      "português do Brasil",
    );
  });
});

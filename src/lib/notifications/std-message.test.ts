import { describe, it, expect } from "vitest";
import { interpolateBaseTags, applySiteTags, normalizeMsisdn } from "./std-message";

describe("interpolateBaseTags", () => {
  const tags = { nomes: "Ana & Lucas", convidados: "Família Silva", data: "21 de setembro", local: "Espaço Di Fieri" };

  it("substitui as variáveis básicas, inclusive no meio do texto", () => {
    expect(interpolateBaseTags("Oi {convidados}, {nomes} casam em {data} no {local}!", tags)).toBe(
      "Oi Família Silva, Ana & Lucas casam em 21 de setembro no Espaço Di Fieri!",
    );
  });

  it("mantém {site} e {site-presentes} intactas", () => {
    expect(interpolateBaseTags("Veja {site} e {site-presentes}", tags)).toBe(
      "Veja {site} e {site-presentes}",
    );
  });

  it("deixa variáveis desconhecidas como estão", () => {
    expect(interpolateBaseTags("{foo}", tags)).toBe("{foo}");
  });
});

describe("applySiteTags", () => {
  const links = { siteUrl: "https://noivos.com", registryUrl: "https://lista.com/123" };

  it("substitui ambas e marca como usadas", () => {
    const r = applySiteTags("Site: {site} | Lista: {site-presentes}", links);
    expect(r.text).toBe("Site: https://noivos.com | Lista: https://lista.com/123");
    expect(r.usedSite).toBe(true);
    expect(r.usedRegistry).toBe(true);
  });

  it("não confunde {site} com o prefixo de {site-presentes}", () => {
    const r = applySiteTags("{site-presentes}", links);
    expect(r.text).toBe("https://lista.com/123");
    expect(r.usedRegistry).toBe(true);
    expect(r.usedSite).toBe(false);
  });

  it("usadas ficam false quando as variáveis não aparecem", () => {
    const r = applySiteTags("sem links", links);
    expect(r.usedSite).toBe(false);
    expect(r.usedRegistry).toBe(false);
    expect(r.text).toBe("sem links");
  });
});

describe("normalizeMsisdn", () => {
  it("preserva DDI estrangeiro (+1, +34) — só tira formatação", () => {
    expect(normalizeMsisdn("+1 415 555 0100")).toBe("+14155550100");
    expect(normalizeMsisdn("+34 600 12 34 56")).toBe("+34600123456");
    expect(normalizeMsisdn("+351 912 345 678")).toBe("+351912345678");
  });

  it("completa +55 para números BR sem DDI", () => {
    expect(normalizeMsisdn("11999990000")).toBe("+5511999990000");
    expect(normalizeMsisdn("(11) 99999-0000")).toBe("+5511999990000");
    expect(normalizeMsisdn("1133334444")).toBe("+551133334444");
  });

  it("prefixa + quando já vem 55 + DDD + número sem o sinal", () => {
    expect(normalizeMsisdn("5511999990000")).toBe("+5511999990000");
  });

  it("devolve original quando não há regra segura", () => {
    expect(normalizeMsisdn("123")).toBe("123");
    expect(normalizeMsisdn("")).toBe("");
    expect(normalizeMsisdn(null)).toBeNull();
  });
});

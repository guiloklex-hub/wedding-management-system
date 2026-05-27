import { describe, it, expect } from "vitest";
import { wedyImporter } from "./wedy";
import type { RecordRow } from "./types";

const FULL_HEADERS = [
  "Nome do convite",
  "Nome completo do convidado",
  "Status",
  "Telefone",
  "E-mail",
  "Tags",
  "Faixa etária",
  "Idade exata (caso for criança)",
  "Pin do convite",
];

function buildRecord(values: Record<string, string>): RecordRow {
  const rec: RecordRow = {};
  for (const h of FULL_HEADERS) rec[h] = values[h] ?? "";
  return rec;
}

function row(values: Record<string, string>): RecordRow {
  return buildRecord(values);
}

describe("wedyImporter.detect", () => {
  it("detecta com todos os headers Wedy", () => {
    expect(wedyImporter.detect([], FULL_HEADERS)).toBe(true);
  });

  it("detecta com 6 das 9 colunas esperadas", () => {
    expect(
      wedyImporter.detect([], [
        "Nome do convite",
        "Nome completo do convidado",
        "Status",
        "Telefone",
        "E-mail",
        "Tags",
      ]),
    ).toBe(true);
  });

  it("não detecta com headers incompatíveis", () => {
    expect(
      wedyImporter.detect([], ["Outro Sistema", "Coluna Bizarra", "Algo Mais"]),
    ).toBe(false);
  });

  it("não detecta sem headers", () => {
    expect(wedyImporter.detect([], [])).toBe(false);
  });
});

describe("wedyImporter.parseRecords", () => {
  it("mapeia todos os campos básicos de uma linha completa", () => {
    const rows = wedyImporter.parseRecords([
      row({
        "Nome do convite": "Família Silva",
        "Nome completo do convidado": "Maria Silva",
        "Status": "Sem resposta",
        "Telefone": "+5511999990000",
        "E-mail": "maria@x.com",
        "Tags": "Padrinhos, Tayná",
        "Faixa etária": "Adulto",
        "Pin do convite": "8696",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Maria Silva",
      groupName: "Família Silva",
      phone: "+5511999990000",
      email: "maria@x.com",
      rsvpStatus: "INVITED",
      rsvpStatusRaw: "Sem resposta",
      tags: ["Padrinhos", "Tayná"],
      isChild: false,
      age: null,
      pin: "8696",
    });
  });

  it("mapeia status: Confirmado/Recusado/Talvez/Não convidado", () => {
    const rows = wedyImporter.parseRecords([
      row({ "Nome do convite": "G1", "Nome completo do convidado": "A", "Status": "Confirmado", "Faixa etária": "Adulto" }),
      row({ "Nome do convite": "G2", "Nome completo do convidado": "B", "Status": "Recusado", "Faixa etária": "Adulto" }),
      row({ "Nome do convite": "G3", "Nome completo do convidado": "C", "Status": "Talvez", "Faixa etária": "Adulto" }),
      row({ "Nome do convite": "G4", "Nome completo do convidado": "D", "Status": "Não convidado", "Faixa etária": "Adulto" }),
    ]);
    expect(rows.map((r) => r.rsvpStatus)).toEqual([
      "CONFIRMED",
      "DECLINED",
      "MAYBE",
      "NOT_INVITED",
    ]);
  });

  it("status desconhecido cai em INVITED e preserva rsvpStatusRaw", () => {
    const [r] = wedyImporter.parseRecords([
      row({ "Nome do convite": "G", "Nome completo do convidado": "X", "Status": "Coisa-Estranha", "Faixa etária": "Adulto" }),
    ]);
    expect(r.rsvpStatus).toBe("INVITED");
    expect(r.rsvpStatusRaw).toBe("Coisa-Estranha");
  });

  it("isChild=true quando Faixa etária = Criança", () => {
    const [r] = wedyImporter.parseRecords([
      row({ "Nome do convite": "G", "Nome completo do convidado": "Kid", "Status": "Sem resposta", "Faixa etária": "Criança", "Idade exata (caso for criança)": "8" }),
    ]);
    expect(r.isChild).toBe(true);
    expect(r.age).toBe(8);
  });

  it("ignora 'Idade desconhecida' (não-numérica) preenchendo age=null", () => {
    const [r] = wedyImporter.parseRecords([
      row({ "Nome do convite": "G", "Nome completo do convidado": "Kid", "Status": "Sem resposta", "Faixa etária": "Criança", "Idade exata (caso for criança)": "Idade desconhecida" }),
    ]);
    expect(r.age).toBeNull();
  });

  it("rejeita idade fora do range 0-17", () => {
    const [r] = wedyImporter.parseRecords([
      row({ "Nome do convite": "G", "Nome completo do convidado": "X", "Status": "Sem resposta", "Faixa etária": "Criança", "Idade exata (caso for criança)": "25" }),
    ]);
    expect(r.age).toBeNull();
  });

  it("rejeita PIN com formato inválido", () => {
    const rows = wedyImporter.parseRecords([
      row({ "Nome do convite": "G", "Nome completo do convidado": "X", "Status": "Sem resposta", "Faixa etária": "Adulto", "Pin do convite": "abc" }),
      row({ "Nome do convite": "G", "Nome completo do convidado": "Y", "Status": "Sem resposta", "Faixa etária": "Adulto", "Pin do convite": "ABCDEFGHIJK" }),
      row({ "Nome do convite": "G", "Nome completo do convidado": "Z", "Status": "Sem resposta", "Faixa etária": "Adulto", "Pin do convite": "1234" }),
      row({ "Nome do convite": "G", "Nome completo do convidado": "W", "Status": "Sem resposta", "Faixa etária": "Adulto", "Pin do convite": "AB12" }),
    ]);
    expect(rows[0].pin).toBeNull();
    expect(rows[1].pin).toBeNull();
    expect(rows[2].pin).toBe("1234");
    expect(rows[3].pin).toBe("AB12");
  });

  it("split e trim de tags, limita a 20", () => {
    const many = Array.from({ length: 25 }, (_, i) => `t${i}`).join(", ");
    const [r] = wedyImporter.parseRecords([
      row({ "Nome do convite": "G", "Nome completo do convidado": "X", "Status": "Sem resposta", "Faixa etária": "Adulto", "Tags": many }),
    ]);
    expect(r.tags).toHaveLength(20);
    expect(r.tags[0]).toBe("t0");
    expect(r.tags[19]).toBe("t19");
  });

  it("descarta linha sem nome", () => {
    const rows = wedyImporter.parseRecords([
      row({ "Nome do convite": "G", "Nome completo do convidado": "  ", "Status": "Sem resposta", "Faixa etária": "Adulto" }),
      row({ "Nome do convite": "G", "Nome completo do convidado": "Ana", "Status": "Sem resposta", "Faixa etária": "Adulto" }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Ana"]);
  });

  it("aplica limites de tamanho a name/groupName/phone/email", () => {
    const [r] = wedyImporter.parseRecords([
      row({
        "Nome do convite": "g".repeat(200),
        "Nome completo do convidado": "n".repeat(200),
        "Status": "Sem resposta",
        "Telefone": "p".repeat(100),
        "E-mail": `${"e".repeat(200)}@x.com`,
        "Faixa etária": "Adulto",
      }),
    ]);
    expect(r.name.length).toBe(160);
    expect(r.groupName?.length).toBe(80);
    expect(r.phone?.length).toBe(40);
    expect(r.email?.length).toBe(160);
  });

  it("preserva tags com nomes dos noivos (case original)", () => {
    const [r] = wedyImporter.parseRecords([
      row({ "Nome do convite": "G", "Nome completo do convidado": "X", "Status": "Sem resposta", "Faixa etária": "Adulto", "Tags": "Tayná, Guilherme" }),
    ]);
    expect(r.tags).toEqual(["Tayná", "Guilherme"]);
  });

  it("indica que contatos pertencem ao grupo (não ao indivíduo)", () => {
    expect(wedyImporter.contactsBelongToGroup).toBe(true);
  });
});

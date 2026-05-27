import { describe, it, expect } from "vitest";
import { internalCsvImporter } from "./internal-csv";
import type { RecordRow } from "./types";

const FULL_HEADERS = [
  "Nome",
  "Telefone",
  "Email",
  "Lado",
  "Grupo",
  "Status",
  "+1 confirmados",
  "Mesa",
  "Restrições",
  "Cidade",
  "Padrinho",
  "VIP",
  "Criança",
];

function rec(values: Record<string, string>): RecordRow {
  const r: RecordRow = {};
  for (const h of FULL_HEADERS) r[h] = values[h] ?? "";
  return r;
}

describe("internalCsvImporter.detect", () => {
  it("detecta header completo", () => {
    expect(internalCsvImporter.detect([], FULL_HEADERS)).toBe(true);
  });

  it("detecta com 8 colunas (mínimo) — desde que tenha Nome, Status e Grupo", () => {
    expect(
      internalCsvImporter.detect([], [
        "Nome",
        "Telefone",
        "Email",
        "Grupo",
        "Status",
        "Mesa",
        "Cidade",
        "VIP",
      ]),
    ).toBe(true);
  });

  it("não detecta sem Nome/Status/Grupo obrigatórios", () => {
    expect(
      internalCsvImporter.detect([], [
        "Nome",
        "Telefone",
        "Email",
        "Lado",
        "Mesa",
        "Restrições",
        "Cidade",
        "VIP",
      ]),
    ).toBe(false);
  });

  it("não detecta planilha do Wedy (headers diferentes)", () => {
    expect(
      internalCsvImporter.detect([], [
        "Nome do convite",
        "Nome completo do convidado",
        "Status",
        "Telefone",
      ]),
    ).toBe(false);
  });
});

describe("internalCsvImporter.parseRecords", () => {
  it("mapeia uma linha completa", () => {
    const [r] = internalCsvImporter.parseRecords([
      rec({
        Nome: "Maria Silva",
        Telefone: "11999990000",
        Email: "maria@x.com",
        Lado: "NOIVA",
        Grupo: "Família Silva",
        Status: "Confirmado",
        "+1 confirmados": "2",
        Mesa: "5",
        Restrições: "vegetariana",
        Cidade: "São Paulo",
        Padrinho: "sim",
        VIP: "sim",
        Criança: "",
      }),
    ]);
    expect(r).toMatchObject({
      name: "Maria Silva",
      groupName: "Família Silva",
      phone: "11999990000",
      email: "maria@x.com",
      side: "NOIVA",
      rsvpStatus: "CONFIRMED",
      rsvpStatusRaw: "Confirmado",
      isVIP: true,
      isChild: false,
      plusOnesAllowed: 2,
      tableNumber: "5",
      dietary: "vegetariana",
      city: "São Paulo",
      pin: null,
      age: null,
    });
    expect(r.tags).toEqual(["Padrinhos"]);
  });

  it("mapeia status pt-BR (Recusou, Convidado, Talvez, Não convidado)", () => {
    const rows = internalCsvImporter.parseRecords([
      rec({ Nome: "A", Grupo: "G", Status: "Recusou" }),
      rec({ Nome: "B", Grupo: "G", Status: "Convidado" }),
      rec({ Nome: "C", Grupo: "G", Status: "Talvez" }),
      rec({ Nome: "D", Grupo: "G", Status: "Não convidado" }),
    ]);
    expect(rows.map((r) => r.rsvpStatus)).toEqual([
      "DECLINED",
      "INVITED",
      "MAYBE",
      "NOT_INVITED",
    ]);
  });

  it("Padrinho='' não vira tag Padrinhos", () => {
    const [r] = internalCsvImporter.parseRecords([
      rec({ Nome: "X", Grupo: "G", Status: "Convidado", Padrinho: "" }),
    ]);
    expect(r.tags).toEqual([]);
  });

  it("isChild=true quando coluna Criança='sim'", () => {
    const [r] = internalCsvImporter.parseRecords([
      rec({ Nome: "K", Grupo: "G", Status: "Convidado", Criança: "sim" }),
    ]);
    expect(r.isChild).toBe(true);
  });

  it("ignora Lado inválido", () => {
    const [r] = internalCsvImporter.parseRecords([
      rec({ Nome: "X", Grupo: "G", Status: "Convidado", Lado: "ABC" }),
    ]);
    expect(r.side).toBeNull();
  });

  it("plusOnesAllowed só aceita 0-10 inteiro", () => {
    const rows = internalCsvImporter.parseRecords([
      rec({ Nome: "A", Grupo: "G", Status: "Convidado", "+1 confirmados": "11" }),
      rec({ Nome: "B", Grupo: "G", Status: "Convidado", "+1 confirmados": "abc" }),
      rec({ Nome: "C", Grupo: "G", Status: "Convidado", "+1 confirmados": "3" }),
    ]);
    expect(rows[0].plusOnesAllowed).toBeUndefined();
    expect(rows[1].plusOnesAllowed).toBeUndefined();
    expect(rows[2].plusOnesAllowed).toBe(3);
  });

  it("descarta linha sem nome", () => {
    const rows = internalCsvImporter.parseRecords([
      rec({ Nome: "  ", Grupo: "G", Status: "Convidado" }),
      rec({ Nome: "Ana", Grupo: "G", Status: "Convidado" }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Ana"]);
  });

  it("indica que contatos NÃO pertencem ao grupo (cada linha tem dados próprios)", () => {
    expect(internalCsvImporter.contactsBelongToGroup).toBe(false);
  });
});

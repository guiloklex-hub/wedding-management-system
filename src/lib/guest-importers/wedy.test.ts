import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import { wedyImporter } from "./wedy";

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

async function buildWedyXlsx(
  rows: Array<Array<string | number>>,
  headers: string[] = FULL_HEADERS,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(headers);
  for (const row of rows) ws.addRow(row);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

async function buildEmptyXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Sheet1");
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

describe("wedyImporter.detect", () => {
  let fullBuf: Buffer;
  let partialBuf: Buffer;
  let foreignBuf: Buffer;
  let emptyBuf: Buffer;

  beforeAll(async () => {
    fullBuf = await buildWedyXlsx([["Família A", "Ana", "Sem resposta", "", "", "", "Adulto", "", ""]]);
    // 6 colunas das esperadas presentes
    partialBuf = await buildWedyXlsx(
      [["A", "B", "C", "D", "E", "F"]],
      [
        "Nome do convite",
        "Nome completo do convidado",
        "Status",
        "Telefone",
        "E-mail",
        "Tags",
      ],
    );
    foreignBuf = await buildWedyXlsx(
      [["x"]],
      ["Outro Sistema", "Coluna Bizarra", "Algo Mais"],
    );
    emptyBuf = await buildEmptyXlsx();
  });

  it("detecta planilha com todos os headers Wedy", async () => {
    expect(await wedyImporter.detect(fullBuf)).toBe(true);
  });

  it("detecta planilha com 6 das 9 colunas esperadas", async () => {
    expect(await wedyImporter.detect(partialBuf)).toBe(true);
  });

  it("não detecta planilha com headers incompatíveis", async () => {
    expect(await wedyImporter.detect(foreignBuf)).toBe(false);
  });

  it("não detecta planilha vazia", async () => {
    expect(await wedyImporter.detect(emptyBuf)).toBe(false);
  });

  it("retorna false (não lança) para buffer inválido", async () => {
    expect(await wedyImporter.detect(Buffer.from([0, 1, 2, 3]))).toBe(false);
  });
});

describe("wedyImporter.parse", () => {
  it("mapeia todos os campos básicos de uma linha completa", async () => {
    const buf = await buildWedyXlsx([
      ["Família Silva", "Maria Silva", "Sem resposta", "+5511999990000", "maria@x.com", "Padrinhos, Tayná", "Adulto", "", "8696"],
    ]);
    const rows = await wedyImporter.parse(buf);
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

  it("mapeia status: Confirmado/Recusado/Talvez", async () => {
    const buf = await buildWedyXlsx([
      ["G1", "A", "Confirmado", "", "", "", "Adulto", "", ""],
      ["G2", "B", "Recusado", "", "", "", "Adulto", "", ""],
      ["G3", "C", "Talvez", "", "", "", "Adulto", "", ""],
      ["G4", "D", "Não convidado", "", "", "", "Adulto", "", ""],
    ]);
    const rows = await wedyImporter.parse(buf);
    expect(rows.map((r) => r.rsvpStatus)).toEqual([
      "CONFIRMED",
      "DECLINED",
      "MAYBE",
      "NOT_INVITED",
    ]);
  });

  it("status desconhecido cai em INVITED e preserva rsvpStatusRaw", async () => {
    const buf = await buildWedyXlsx([
      ["G", "X", "Coisa-Estranha", "", "", "", "Adulto", "", ""],
    ]);
    const [row] = await wedyImporter.parse(buf);
    expect(row.rsvpStatus).toBe("INVITED");
    expect(row.rsvpStatusRaw).toBe("Coisa-Estranha");
  });

  it("isChild=true quando Faixa etária = Criança", async () => {
    const buf = await buildWedyXlsx([
      ["G", "Kid", "Sem resposta", "", "", "", "Criança", "8", ""],
    ]);
    const [row] = await wedyImporter.parse(buf);
    expect(row.isChild).toBe(true);
    expect(row.age).toBe(8);
  });

  it("ignora 'Idade desconhecida' (não-numérica) preenchendo age=null", async () => {
    const buf = await buildWedyXlsx([
      ["G", "Kid", "Sem resposta", "", "", "", "Criança", "Idade desconhecida", ""],
    ]);
    const [row] = await wedyImporter.parse(buf);
    expect(row.age).toBeNull();
  });

  it("rejeita idade fora do range 0-17", async () => {
    const buf = await buildWedyXlsx([
      ["G", "X", "Sem resposta", "", "", "", "Criança", "25", ""],
    ]);
    const [row] = await wedyImporter.parse(buf);
    expect(row.age).toBeNull();
  });

  it("rejeita PIN com formato inválido", async () => {
    const buf = await buildWedyXlsx([
      ["G", "X", "Sem resposta", "", "", "", "Adulto", "", "abc"],
      ["G", "Y", "Sem resposta", "", "", "", "Adulto", "", "ABCDEFGHIJK"],
      ["G", "Z", "Sem resposta", "", "", "", "Adulto", "", "1234"],
      ["G", "W", "Sem resposta", "", "", "", "Adulto", "", "AB12"],
    ]);
    const rows = await wedyImporter.parse(buf);
    expect(rows[0].pin).toBeNull();
    expect(rows[1].pin).toBeNull();
    expect(rows[2].pin).toBe("1234");
    expect(rows[3].pin).toBe("AB12");
  });

  it("split e trim de tags, limita a 20", async () => {
    const many = Array.from({ length: 25 }, (_, i) => `t${i}`).join(", ");
    const buf = await buildWedyXlsx([
      ["G", "X", "Sem resposta", "", "", many, "Adulto", "", ""],
    ]);
    const [row] = await wedyImporter.parse(buf);
    expect(row.tags).toHaveLength(20);
    expect(row.tags[0]).toBe("t0");
    expect(row.tags[19]).toBe("t19");
  });

  it("descarta linha sem nome", async () => {
    const buf = await buildWedyXlsx([
      ["G", "  ", "Sem resposta", "", "", "", "Adulto", "", ""],
      ["G", "Ana", "Sem resposta", "", "", "", "Adulto", "", ""],
    ]);
    const rows = await wedyImporter.parse(buf);
    expect(rows.map((r) => r.name)).toEqual(["Ana"]);
  });

  it("aplica limites de tamanho a name/groupName/phone/email", async () => {
    const buf = await buildWedyXlsx([
      [
        "g".repeat(200),
        "n".repeat(200),
        "Sem resposta",
        "p".repeat(100),
        `${"e".repeat(200)}@x.com`,
        "",
        "Adulto",
        "",
        "",
      ],
    ]);
    const [row] = await wedyImporter.parse(buf);
    expect(row.name.length).toBe(160);
    expect(row.groupName?.length).toBe(80);
    expect(row.phone?.length).toBe(40);
    expect(row.email?.length).toBe(160);
  });

  it("preserva tags com nomes dos noivos (case original)", async () => {
    const buf = await buildWedyXlsx([
      ["G", "X", "Sem resposta", "", "", "Tayná, Guilherme", "Adulto", "", ""],
    ]);
    const [row] = await wedyImporter.parse(buf);
    expect(row.tags).toEqual(["Tayná", "Guilherme"]);
  });
});

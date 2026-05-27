import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { extractCsvRecords, extractXlsxRecords } from "./extract";

describe("extractCsvRecords", () => {
  it("detecta vírgula, parseia header + linhas", () => {
    const csv = `Nome,Email,Grupo\nMaria,maria@x,Família A\nJoão,,Família A`;
    const { headers, records } = extractCsvRecords(csv);
    expect(headers).toEqual(["Nome", "Email", "Grupo"]);
    expect(records).toEqual([
      { Nome: "Maria", Email: "maria@x", Grupo: "Família A" },
      { Nome: "João", Email: "", Grupo: "Família A" },
    ]);
  });

  it("detecta ponto-vírgula", () => {
    const csv = `Nome;Email\nMaria;maria@x`;
    const { headers, records } = extractCsvRecords(csv);
    expect(headers).toEqual(["Nome", "Email"]);
    expect(records[0]).toEqual({ Nome: "Maria", Email: "maria@x" });
  });

  it("respeita aspas duplas com vírgula interna", () => {
    const csv = `Nome,Tags\n"Maria","Padrinhos, Família"`;
    const { records } = extractCsvRecords(csv);
    expect(records[0].Tags).toBe("Padrinhos, Família");
  });

  it('aspas duplas escapadas ("")', () => {
    const csv = `Nome\n"Ana ""A"" Silva"`;
    const { records } = extractCsvRecords(csv);
    expect(records[0].Nome).toBe('Ana "A" Silva');
  });

  it("ignora BOM UTF-8 no início", () => {
    const csv = `﻿Nome,Email\nMaria,maria@x`;
    const { headers } = extractCsvRecords(csv);
    expect(headers).toEqual(["Nome", "Email"]);
  });

  it("ignora linhas totalmente vazias", () => {
    const csv = `Nome\nMaria\n\nJoão\n`;
    const { records } = extractCsvRecords(csv);
    expect(records.map((r) => r.Nome)).toEqual(["Maria", "João"]);
  });

  it("aceita quebra de linha dentro de aspas", () => {
    const csv = `Nome,Notes\n"Maria","linha 1\nlinha 2"`;
    const { records } = extractCsvRecords(csv);
    expect(records[0].Notes).toBe("linha 1\nlinha 2");
  });

  it("retorna vazio para entrada vazia", () => {
    const { headers, records } = extractCsvRecords("");
    expect(headers).toEqual([]);
    expect(records).toEqual([]);
  });
});

describe("extractXlsxRecords", () => {
  it("lê primeira sheet com header + linhas", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.addRow(["Nome", "Email"]);
    ws.addRow(["Maria", "maria@x"]);
    ws.addRow(["João", ""]);
    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    const { headers, records } = await extractXlsxRecords(buf);
    expect(headers).toEqual(["Nome", "Email"]);
    expect(records).toEqual([
      { Nome: "Maria", Email: "maria@x" },
      { Nome: "João", Email: "" },
    ]);
  });

  it("retorna estrutura vazia se a planilha não tem worksheets", async () => {
    const wb = new ExcelJS.Workbook();
    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const { records } = await extractXlsxRecords(buf);
    expect(records).toEqual([]);
  });
});

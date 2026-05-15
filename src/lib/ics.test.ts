import { describe, it, expect } from "vitest";
import { buildICS } from "./ics";

describe("buildICS", () => {
  it("retorna VCALENDAR válido com header e footer", () => {
    const out = buildICS([], "Test Cal");
    const lines = out.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("X-WR-CALNAME:Test Cal");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
  });

  it("usa CRLF como separador de linha (RFC 5545)", () => {
    const out = buildICS([
      { uid: "u1", summary: "Test", date: new Date(Date.UTC(2026, 10, 15, 14, 30)) },
    ]);
    expect(out.includes("\r\n")).toBe(true);
    // Nenhuma quebra de linha sem CR antes
    expect(/(^|[^\r])\n/.test(out)).toBe(false);
  });

  it("renderiza evento com DTSTART em UTC", () => {
    const out = buildICS([
      {
        uid: "evt-1",
        summary: "Reunião",
        date: new Date(Date.UTC(2026, 10, 15, 14, 30, 0)),
      },
    ]);
    expect(out).toContain("UID:evt-1@wedding-finance");
    expect(out).toContain("DTSTART:20261115T143000Z");
    expect(out).toContain("DTEND:20261115T150000Z"); // +30min
    expect(out).toContain("SUMMARY:Reunião");
  });

  it("evento all-day usa VALUE=DATE com dia seguinte como DTEND", () => {
    const out = buildICS([
      {
        uid: "wedding",
        summary: "Casamento",
        date: new Date(Date.UTC(2026, 10, 15)),
        allDay: true,
      },
    ]);
    expect(out).toContain("DTSTART;VALUE=DATE:20261115");
    expect(out).toContain("DTEND;VALUE=DATE:20261116");
  });

  it("escapa vírgulas, ponto-e-vírgula e quebras de linha em summary/description", () => {
    const out = buildICS([
      {
        uid: "x",
        summary: "Foo, bar; baz",
        description: "linha 1\nlinha 2",
        date: new Date(Date.UTC(2026, 0, 1)),
      },
    ]);
    expect(out).toContain("SUMMARY:Foo\\, bar\\; baz");
    expect(out).toContain("DESCRIPTION:linha 1\\nlinha 2");
  });

  it("inclui URL quando fornecida", () => {
    const out = buildICS([
      {
        uid: "x",
        summary: "x",
        url: "https://example.com/evento",
        date: new Date(Date.UTC(2026, 0, 1)),
      },
    ]);
    expect(out).toContain("URL:https://example.com/evento");
  });
});

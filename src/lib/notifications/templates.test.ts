import { describe, it, expect } from "vitest";
import { escapeHtml, escapeWaMarkdown, render } from "./templates";

describe("escapeHtml", () => {
  it("escapa caracteres especiais", () => {
    expect(escapeHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
    );
  });
});

describe("escapeWaMarkdown", () => {
  it("escapa asteriscos e underlines", () => {
    expect(escapeWaMarkdown("*bold* _italic_")).toBe("\\*bold\\* \\_italic\\_");
  });
});

describe("render", () => {
  it("renderiza ACCOUNT_CREATED com senha temporária", () => {
    const r = render({
      kind: "ACCOUNT_CREATED",
      userName: "Ana",
      tempPassword: "sup3rs3cr3t",
      loginUrl: "https://app.example.com/login",
    });
    expect(r.subject).toMatch(/conta/i);
    expect(r.html).toContain("sup3rs3cr3t");
    expect(r.text).toContain("sup3rs3cr3t");
    expect(r.waText).toContain("sup3rs3cr3t");
  });

  it("escapa nome em ACCOUNT_CREATED para evitar XSS no HTML", () => {
    const r = render({
      kind: "ACCOUNT_CREATED",
      userName: "<script>x</script>",
      tempPassword: "abc",
      loginUrl: "https://x",
    });
    expect(r.html).not.toContain("<script>x</script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("renderiza PASSWORD_RESET com URL e tempo de expiração", () => {
    const r = render({
      kind: "PASSWORD_RESET",
      userName: "Bob",
      resetUrl: "https://app/reset/abc",
      expiresInMinutes: 60,
    });
    expect(r.html).toContain("https://app/reset/abc");
    expect(r.text).toContain("60 minutos");
    expect(r.waText).toContain("60 minutos");
  });

  it("renderiza PAYMENT_DUE formatando valor BRL", () => {
    const r = render({
      kind: "PAYMENT_DUE",
      userName: "Ana",
      vendorName: "Buffet ABC",
      amount: 1500,
      dueDate: new Date("2026-12-01T12:00:00Z"),
      daysUntilDue: 3,
    });
    expect(r.html).toMatch(/R\$\s*1\.500,00/);
    expect(r.waText).toMatch(/Buffet ABC/);
  });

  it("PAYMENT_OVERDUE usa 'atrasado' no texto", () => {
    const r = render({
      kind: "PAYMENT_OVERDUE",
      userName: "Ana",
      vendorName: "Florista",
      amount: 800,
      dueDate: new Date("2026-01-01T12:00:00Z"),
      daysOverdue: 5,
    });
    expect(r.subject).toMatch(/atrasado/i);
    expect(r.text).toMatch(/atrasado há 5 dia/i);
  });
});

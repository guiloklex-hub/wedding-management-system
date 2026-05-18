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

describe("render (pt-BR)", () => {
  it("renderiza ACCOUNT_CREATED com senha temporária", async () => {
    const r = await render({
      kind: "ACCOUNT_CREATED",
      userName: "Ana",
      tempPassword: "sup3rs3cr3t",
      loginUrl: "https://app.example.com/login",
      locale: "pt-BR",
    });
    expect(r.subject).toMatch(/conta/i);
    expect(r.html).toContain("sup3rs3cr3t");
    expect(r.text).toContain("sup3rs3cr3t");
    expect(r.waText).toContain("sup3rs3cr3t");
  });

  it("escapa nome em ACCOUNT_CREATED para evitar XSS no HTML", async () => {
    const r = await render({
      kind: "ACCOUNT_CREATED",
      userName: "<script>x</script>",
      tempPassword: "abc",
      loginUrl: "https://x",
      locale: "pt-BR",
    });
    expect(r.html).not.toContain("<script>x</script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("renderiza PASSWORD_RESET com URL e tempo de expiração", async () => {
    const r = await render({
      kind: "PASSWORD_RESET",
      userName: "Bob",
      resetUrl: "https://app/reset/abc",
      expiresInMinutes: 60,
      locale: "pt-BR",
    });
    expect(r.html).toContain("https://app/reset/abc");
    expect(r.text).toMatch(/60 minutos/);
    expect(r.waText).toMatch(/60 minutos/);
  });

  it("renderiza PAYMENT_DUE formatando valor BRL", async () => {
    const r = await render({
      kind: "PAYMENT_DUE",
      userName: "Ana",
      vendorName: "Buffet ABC",
      amount: 1500,
      dueDate: new Date("2026-12-01T12:00:00Z"),
      daysUntilDue: 3,
      locale: "pt-BR",
    });
    expect(r.html).toMatch(/R\$\s*1\.500,00/);
    expect(r.waText).toMatch(/Buffet ABC/);
  });

  it("PAYMENT_OVERDUE usa 'atrasado' no texto", async () => {
    const r = await render({
      kind: "PAYMENT_OVERDUE",
      userName: "Ana",
      vendorName: "Florista",
      amount: 800,
      dueDate: new Date("2026-01-01T12:00:00Z"),
      daysOverdue: 5,
      locale: "pt-BR",
    });
    expect(r.subject).toMatch(/atrasado/i);
    expect(r.text).toMatch(/atrasado/i);
  });
});

describe("render (en)", () => {
  it("renderiza PAYMENT_DUE em inglês com plural correto", async () => {
    const r = await render({
      kind: "PAYMENT_DUE",
      userName: "Ana",
      vendorName: "Buffet ABC",
      amount: 1500,
      currency: "USD",
      dueDate: new Date("2026-12-01T12:00:00Z"),
      daysUntilDue: 3,
      locale: "en",
    });
    expect(r.subject).toMatch(/Payment/i);
    expect(r.subject).toMatch(/3 days/);
  });

  it("renderiza PAYMENT_DUE singular em inglês", async () => {
    const r = await render({
      kind: "PAYMENT_DUE",
      userName: "Ana",
      vendorName: "Buffet",
      amount: 100,
      currency: "USD",
      dueDate: new Date("2026-12-01T12:00:00Z"),
      daysUntilDue: 1,
      locale: "en",
    });
    expect(r.subject).toMatch(/tomorrow/i);
  });
});

describe("render (es)", () => {
  it("renderiza TASK_OVERDUE em espanhol", async () => {
    const r = await render({
      kind: "TASK_OVERDUE",
      userName: "Ana",
      taskTitle: "Reservar local",
      deadline: new Date("2026-01-01T12:00:00Z"),
      daysOverdue: 2,
      locale: "es",
    });
    expect(r.subject).toMatch(/atrasada/i);
    expect(r.text).toMatch(/2 días/);
  });
});

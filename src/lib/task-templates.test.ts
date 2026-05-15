import { describe, it, expect } from "vitest";
import { TASK_TEMPLATES, templateDeadline } from "./task-templates";

describe("TASK_TEMPLATES", () => {
  it("não tem keys duplicadas", () => {
    const keys = TASK_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("todos têm título não-vazio", () => {
    for (const t of TASK_TEMPLATES) {
      expect(t.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("prioridades estão dentro do enum", () => {
    const allowed = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);
    for (const t of TASK_TEMPLATES) {
      expect(allowed.has(t.priority)).toBe(true);
    }
  });
});

describe("templateDeadline", () => {
  const eventDate = new Date(Date.UTC(2026, 10, 15)); // 15 nov 2026

  it("subtrai N meses do evento", () => {
    const d = templateDeadline(eventDate, {
      key: "x",
      title: "x",
      monthsBefore: 3,
      priority: "MEDIUM",
    });
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7); // agosto
    expect(d.getUTCDate()).toBe(15);
  });

  it("aplica daysOffset negativo (dias antes do evento)", () => {
    const d = templateDeadline(eventDate, {
      key: "x",
      title: "x",
      monthsBefore: 0,
      daysOffset: -7,
      priority: "URGENT",
    });
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(10);
    expect(d.getUTCDate()).toBe(8);
  });

  it("aplica daysOffset positivo (dias após o evento)", () => {
    const d = templateDeadline(eventDate, {
      key: "x",
      title: "x",
      monthsBefore: -1,
      daysOffset: 30,
      priority: "LOW",
    });
    // +1 mês (dez) e +30 dias = jan/2027
    expect(d.getUTCFullYear()).toBe(2027);
  });

  it("não muta o eventDate original", () => {
    const original = eventDate.getTime();
    templateDeadline(eventDate, {
      key: "x",
      title: "x",
      monthsBefore: 6,
      priority: "HIGH",
    });
    expect(eventDate.getTime()).toBe(original);
  });
});

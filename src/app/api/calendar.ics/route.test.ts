import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

import { GET } from "./route";

beforeEach(() => {
  authMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.eventSettings.upsert.mockResolvedValue({
    id: "singleton",
    eventDate: new Date("2026-11-15T00:00:00Z"),
    contingencyPercent: 10,
    currency: "BRL",
    coupleNames: "Ana & Bob",
  } as never);
});

describe("GET /api/calendar.ics", () => {
  it("retorna 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("retorna 200 com Content-Type ICS e disposição attachment", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.task.findMany.mockResolvedValue([] as never);
    prismaMock.payment.findMany.mockResolvedValue([] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/calendar/);
    expect(res.headers.get("Content-Disposition")).toContain("wedding-finance.ics");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("inclui evento do dia do casamento com nomes dos noivos", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.task.findMany.mockResolvedValue([] as never);
    prismaMock.payment.findMany.mockResolvedValue([] as never);

    const res = await GET();
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("Casamento Ana & Bob");
    expect(body).toContain("DTSTART;VALUE=DATE:20261115");
  });

  it("monta evento de task com descrição agregada", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "t1",
        title: "Provar vestido",
        description: "Levar sapato",
        responsible: "noiva",
        deadline: new Date("2026-10-01T00:00:00Z"),
        vendor: { name: "Ateliê X" },
        venue: null,
      },
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([] as never);

    const res = await GET();
    const body = await res.text();
    expect(body).toContain("📋 Provar vestido");
    expect(body).toContain("Responsável: noiva");
    expect(body).toContain("Fornecedor: Ateliê X");
    expect(body).toContain("Levar sapato");
  });

  it("renderiza pagamento como evento all-day com valor BRL", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.task.findMany.mockResolvedValue([] as never);
    prismaMock.payment.findMany.mockResolvedValue([
      {
        id: "p1",
        amount: 1500,
        dueDate: new Date("2026-09-15T00:00:00Z"),
        status: "PENDING",
        method: "PIX",
        vendor: { name: "Buffet" },
      },
    ] as never);

    const res = await GET();
    const body = await res.text();
    expect(body).toContain("💸 Buffet");
    expect(body).toContain("1.500");
    expect(body).toContain("Pendente");
  });

  it("filtra tasks sem deadline", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.task.findMany.mockResolvedValue([
      { id: "t1", title: "Sem prazo", deadline: null, vendor: null, venue: null },
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([] as never);

    const res = await GET();
    const body = await res.text();
    expect(body).not.toContain("Sem prazo");
  });
});

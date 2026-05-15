import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import { daysUntil, getEventConfig, updateEventConfig } from "./event-config";

const baseRow = {
  id: "singleton",
  eventDate: new Date("2026-11-15T00:00:00Z"),
  contingencyPercent: 10,
  currency: "BRL",
  coupleNames: null,
};

describe("getEventConfig", () => {
  beforeEach(() => {
    prismaMock.eventSettings.upsert.mockResolvedValue(baseRow as never);
  });

  it("faz upsert no row 'singleton' com defaults", async () => {
    await getEventConfig();
    expect(prismaMock.eventSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "singleton" },
        create: expect.objectContaining({
          id: "singleton",
          contingencyPercent: 10,
          currency: "BRL",
        }),
      }),
    );
  });

  it("retorna a config mapeada", async () => {
    const cfg = await getEventConfig();
    expect(cfg).toEqual({
      eventDate: baseRow.eventDate,
      contingencyPercent: 10,
      currency: "BRL",
      coupleNames: null,
    });
  });
});

describe("updateEventConfig", () => {
  it("propaga partial via update e retorna a config nova", async () => {
    prismaMock.eventSettings.upsert.mockResolvedValue(baseRow as never);
    prismaMock.eventSettings.update.mockResolvedValue({
      ...baseRow,
      currency: "USD",
      coupleNames: "A & B",
    } as never);

    const updated = await updateEventConfig({ currency: "USD", coupleNames: "A & B" });

    expect(prismaMock.eventSettings.update).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: {
        eventDate: undefined,
        contingencyPercent: undefined,
        currency: "USD",
        coupleNames: "A & B",
      },
    });
    expect(updated.currency).toBe("USD");
    expect(updated.coupleNames).toBe("A & B");
  });
});

describe("daysUntil", () => {
  it("calcula dias positivos até data futura", () => {
    const from = new Date(Date.UTC(2026, 10, 1));
    const to = new Date(Date.UTC(2026, 10, 11));
    expect(daysUntil(to, from)).toBe(10);
  });

  it("retorna número negativo para data no passado", () => {
    const from = new Date(Date.UTC(2026, 10, 11));
    const to = new Date(Date.UTC(2026, 10, 1));
    expect(daysUntil(to, from)).toBe(-10);
  });

  it("usa `new Date()` como default", () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(daysUntil(future)).toBeGreaterThan(0);
  });
});

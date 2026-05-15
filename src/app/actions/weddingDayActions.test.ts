import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import { updateWeddingDay } from "./weddingDayActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateWeddingDay", () => {
  it("converte campos vazios para null", async () => {
    prismaMock.eventSettings.update.mockResolvedValue({} as never);
    const fd = new FormData();
    fd.set("rainPlanB", "  ");
    fd.set("daySchedule", "");
    fd.set("daySpecialNotes", "");
    const r = await updateWeddingDay(undefined, fd);
    expect(r.success).toBe(true);
    const data = (prismaMock.eventSettings.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.rainPlanB).toBeNull();
    expect(data.daySchedule).toBeNull();
    expect(data.daySpecialNotes).toBeNull();
  });

  it("propaga valores trimados", async () => {
    prismaMock.eventSettings.update.mockResolvedValue({} as never);
    const fd = new FormData();
    fd.set("rainPlanB", "  Plano B: tenda  ");
    fd.set("daySchedule", "08:00 - Café da manhã");
    const r = await updateWeddingDay(undefined, fd);
    expect(r.success).toBe(true);
    const data = (prismaMock.eventSettings.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.rainPlanB).toBe("Plano B: tenda");
    expect(data.daySchedule).toBe("08:00 - Café da manhã");
  });

  it("rejeita rainPlanB acima de 2000 chars", async () => {
    const fd = new FormData();
    fd.set("rainPlanB", "x".repeat(2001));
    const r = await updateWeddingDay(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita daySchedule acima de 8000 chars", async () => {
    const fd = new FormData();
    fd.set("daySchedule", "x".repeat(8001));
    const r = await updateWeddingDay(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("retorna erro quando update lança", async () => {
    prismaMock.eventSettings.update.mockRejectedValue(new Error("db error"));
    const fd = new FormData();
    fd.set("rainPlanB", "ok");
    const r = await updateWeddingDay(undefined, fd);
    expect(r.success).toBe(false);
  });
});

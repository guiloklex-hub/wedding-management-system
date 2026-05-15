import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const updateEventConfigMock = vi.fn();
vi.mock("@/lib/event-config", () => ({
  updateEventConfig: (...args: unknown[]) => updateEventConfigMock(...args),
}));

import { updateSettings } from "./settingsActions";

beforeEach(() => {
  updateEventConfigMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("eventDate", "2026-11-15");
  fd.set("contingencyPercent", "10");
  fd.set("currency", "BRL");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("updateSettings", () => {
  it("rejeita data em formato inválido", async () => {
    const r = await updateSettings(undefined, form({ eventDate: "15-11-2026" }));
    expect(r.success).toBe(false);
    expect(updateEventConfigMock).not.toHaveBeenCalled();
  });

  it("rejeita contingencyPercent fora de [0,100]", async () => {
    const r = await updateSettings(undefined, form({ contingencyPercent: "150" }));
    expect(r.success).toBe(false);
  });

  it("rejeita currency fora do enum", async () => {
    const r = await updateSettings(undefined, form({ currency: "GBP" }));
    expect(r.success).toBe(false);
  });

  it("converte coupleNames vazio para null", async () => {
    updateEventConfigMock.mockResolvedValue(undefined);
    await updateSettings(undefined, form({ coupleNames: "  " }));
    const args = updateEventConfigMock.mock.calls[0][0];
    expect(args.coupleNames).toBeNull();
  });

  it("propaga eventDate como Date", async () => {
    updateEventConfigMock.mockResolvedValue(undefined);
    await updateSettings(undefined, form({ eventDate: "2026-11-15" }));
    const args = updateEventConfigMock.mock.calls[0][0];
    expect(args.eventDate).toBeInstanceOf(Date);
    expect(args.contingencyPercent).toBe(10);
    expect(args.currency).toBe("BRL");
  });

  it("retorna erro genérico quando updateEventConfig lança", async () => {
    updateEventConfigMock.mockRejectedValue(new Error("db error"));
    const r = await updateSettings(undefined, form());
    expect(r.success).toBe(false);
  });
});

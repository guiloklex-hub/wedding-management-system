import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  addChecklistItem,
  createVenue,
  deleteChecklistItem,
  deleteVenue,
  toggleChecklistItem,
  updateVenue,
} from "./venueActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Espaço A");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

function setupTransaction() {
  prismaMock.$transaction.mockImplementation(async (fnOrArr) => {
    if (typeof fnOrArr === "function") {
      return fnOrArr(prismaMock as never);
    }
    return [];
  });
}

describe("createVenue", () => {
  it("rejeita nome vazio", async () => {
    const r = await createVenue(undefined, form({ name: "" }));
    expect(r.success).toBe(false);
  });

  it("seedChecklist=on cria itens do DEFAULT_VENUE_CHECKLIST", async () => {
    setupTransaction();
    prismaMock.venue.create.mockResolvedValue({ id: "vn1" } as never);
    prismaMock.venueChecklistItem.createMany.mockResolvedValue({ count: 20 } as never);

    const r = await createVenue(undefined, form({ seedChecklist: "on" }));
    expect(r.success).toBe(true);
    expect(prismaMock.venueChecklistItem.createMany).toHaveBeenCalled();
    const data = (prismaMock.venueChecklistItem.createMany.mock.calls[0][0] as { data: unknown[] }).data;
    expect(data.length).toBeGreaterThan(10);
  });

  it("seedChecklist ausente no form não cria checklist (checkbox unchecked)", async () => {
    setupTransaction();
    prismaMock.venue.create.mockResolvedValue({ id: "vn1" } as never);

    await createVenue(undefined, form());
    expect(prismaMock.venueChecklistItem.createMany).not.toHaveBeenCalled();
  });
});

describe("updateVenue", () => {
  it("erro quando count===0", async () => {
    prismaMock.venue.updateMany.mockResolvedValue({ count: 0 } as never);
    const fd = form({ id: "vn1" });
    const r = await updateVenue(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("deleteVenue", () => {
  it("soft delete", async () => {
    prismaMock.venue.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteVenue("vn1");
    expect(prismaMock.venue.updateMany).toHaveBeenCalledWith({
      where: { id: "vn1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("addChecklistItem", () => {
  it("rejeita label vazio", async () => {
    const fd = new FormData();
    fd.set("venueId", "vn1");
    fd.set("label", "");
    const r = await addChecklistItem(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("calcula sortOrder = max+1 quando já existem itens", async () => {
    prismaMock.venueChecklistItem.findFirst.mockResolvedValue({ sortOrder: 4 } as never);
    prismaMock.venueChecklistItem.create.mockResolvedValue({} as never);

    const fd = new FormData();
    fd.set("venueId", "vn1");
    fd.set("label", "Estacionamento extra");
    await addChecklistItem(undefined, fd);

    const data = (prismaMock.venueChecklistItem.create.mock.calls[0][0] as { data: { sortOrder: number } }).data;
    expect(data.sortOrder).toBe(5);
  });

  it("sortOrder=0 quando ainda não há itens", async () => {
    prismaMock.venueChecklistItem.findFirst.mockResolvedValue(null);
    prismaMock.venueChecklistItem.create.mockResolvedValue({} as never);

    const fd = new FormData();
    fd.set("venueId", "vn1");
    fd.set("label", "Item");
    await addChecklistItem(undefined, fd);

    const data = (prismaMock.venueChecklistItem.create.mock.calls[0][0] as { data: { sortOrder: number } }).data;
    expect(data.sortOrder).toBe(0);
  });
});

describe("toggleChecklistItem", () => {
  it("trim e slice em value (max 500)", async () => {
    prismaMock.venueChecklistItem.update.mockResolvedValue({ venueId: "vn1" } as never);
    const longValue = "x".repeat(600);
    await toggleChecklistItem("i1", true, longValue);

    const data = (prismaMock.venueChecklistItem.update.mock.calls[0][0] as { data: { value: string | null } }).data;
    expect(data.value?.length).toBe(500);
  });

  it("value vazio vira null", async () => {
    prismaMock.venueChecklistItem.update.mockResolvedValue({ venueId: "vn1" } as never);
    await toggleChecklistItem("i1", false, "   ");
    const data = (prismaMock.venueChecklistItem.update.mock.calls[0][0] as { data: { value: string | null } }).data;
    expect(data.value).toBeNull();
  });
});

describe("deleteChecklistItem", () => {
  it("erro quando item não existe", async () => {
    prismaMock.venueChecklistItem.findUnique.mockResolvedValue(null);
    const r = await deleteChecklistItem("i1");
    expect(r.success).toBe(false);
    expect(prismaMock.venueChecklistItem.delete).not.toHaveBeenCalled();
  });

  it("deleta físico quando encontrado", async () => {
    prismaMock.venueChecklistItem.findUnique.mockResolvedValue({ id: "i1", venueId: "vn1" } as never);
    prismaMock.venueChecklistItem.delete.mockResolvedValue({} as never);

    const r = await deleteChecklistItem("i1");
    expect(r.success).toBe(true);
    expect(prismaMock.venueChecklistItem.delete).toHaveBeenCalledWith({ where: { id: "i1" } });
  });
});

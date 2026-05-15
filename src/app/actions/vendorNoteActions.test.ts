import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import { createVendorNote, deleteVendorNote } from "./vendorNoteActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("vendorId", "v1");
  fd.set("body", "Anotação importante sobre a reunião.");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("createVendorNote", () => {
  it("default kind=NOTE", async () => {
    prismaMock.vendorNote.create.mockResolvedValue({} as never);
    await createVendorNote(undefined, form());
    const data = (prismaMock.vendorNote.create.mock.calls[0][0] as { data: { kind: string } }).data;
    expect(data.kind).toBe("NOTE");
  });

  it("aceita kinds válidos", async () => {
    prismaMock.vendorNote.create.mockResolvedValue({} as never);
    await createVendorNote(undefined, form({ kind: "DECISION" }));
    const data = (prismaMock.vendorNote.create.mock.calls[0][0] as { data: { kind: string } }).data;
    expect(data.kind).toBe("DECISION");
  });

  it("rejeita kind fora do enum", async () => {
    const r = await createVendorNote(undefined, form({ kind: "RANDOM" }));
    expect(r.success).toBe(false);
  });

  it("rejeita body vazio", async () => {
    const r = await createVendorNote(undefined, form({ body: "  " }));
    expect(r.success).toBe(false);
  });

  it("rejeita vendorId ausente", async () => {
    const fd = form();
    fd.delete("vendorId");
    const r = await createVendorNote(undefined, fd);
    expect(r.success).toBe(false);
  });
});

describe("deleteVendorNote", () => {
  it("soft delete escopado por vendorId", async () => {
    prismaMock.vendorNote.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteVendorNote("n1", "v1");
    expect(prismaMock.vendorNote.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", vendorId: "v1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("erro quando não encontrado", async () => {
    prismaMock.vendorNote.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await deleteVendorNote("n1", "v1");
    expect(r.success).toBe(false);
  });
});

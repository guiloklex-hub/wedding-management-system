import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import {
  bulkImportGuests,
  createGuest,
  deleteGuest,
  publicRsvpRespond,
  toggleCheckin,
  updateGuest,
} from "./guestActions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

function guestForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "João Silva");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("createGuest", () => {
  it("rejeita nome vazio", async () => {
    const r = await createGuest(undefined, guestForm({ name: "  " }));
    expect(r.success).toBe(false);
    expect(prismaMock.guest.create).not.toHaveBeenCalled();
  });

  it("aplica defaults (rsvpStatus=INVITED, plusOnesAllowed=0)", async () => {
    prismaMock.guest.create.mockResolvedValue({ id: "g1" } as never);
    await createGuest(undefined, guestForm());
    const data = (prismaMock.guest.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.rsvpStatus).toBe("INVITED");
    expect(data.plusOnesAllowed).toBe(0);
  });

  it("converte checkbox 'on' em boolean true", async () => {
    prismaMock.guest.create.mockResolvedValue({ id: "g1" } as never);
    await createGuest(undefined, guestForm({ isVIP: "on", isChild: "on" }));
    const data = (prismaMock.guest.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.isVIP).toBe(true);
    expect(data.isChild).toBe(true);
  });

  it("limita plusOnesAllowed a 10", async () => {
    const r = await createGuest(undefined, guestForm({ plusOnesAllowed: "11" }));
    expect(r.success).toBe(false);
  });
});

describe("updateGuest", () => {
  it("retorna 'não encontrado' quando count===0", async () => {
    prismaMock.guest.updateMany.mockResolvedValue({ count: 0 } as never);
    const fd = guestForm({ id: "g1" });
    const r = await updateGuest(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("sucesso com count>0", async () => {
    prismaMock.guest.updateMany.mockResolvedValue({ count: 1 } as never);
    const fd = guestForm({ id: "g1" });
    const r = await updateGuest(undefined, fd);
    expect(r.success).toBe(true);
  });
});

describe("deleteGuest (soft delete)", () => {
  it("usa updateMany com deletedAt", async () => {
    prismaMock.guest.updateMany.mockResolvedValue({ count: 1 } as never);
    await deleteGuest("g1");
    expect(prismaMock.guest.updateMany).toHaveBeenCalledWith({
      where: { id: "g1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("toggleCheckin", () => {
  it("seta checkedInAt quando present=true", async () => {
    prismaMock.guest.updateMany.mockResolvedValue({ count: 1 } as never);
    await toggleCheckin("g1", true);
    const call = prismaMock.guest.updateMany.mock.calls[0][0] as {
      data: { checkedInAt: Date | null };
    };
    expect(call.data.checkedInAt).toBeInstanceOf(Date);
  });

  it("limpa checkedInAt quando present=false", async () => {
    prismaMock.guest.updateMany.mockResolvedValue({ count: 1 } as never);
    await toggleCheckin("g1", false);
    const call = prismaMock.guest.updateMany.mock.calls[0][0] as {
      data: { checkedInAt: Date | null };
    };
    expect(call.data.checkedInAt).toBeNull();
  });

  it("retorna erro se ninguém atualizado", async () => {
    prismaMock.guest.updateMany.mockResolvedValue({ count: 0 } as never);
    const r = await toggleCheckin("g1", true);
    expect(r.success).toBe(false);
  });
});

describe("bulkImportGuests", () => {
  it("rejeita raw vazio", async () => {
    const fd = new FormData();
    fd.set("raw", "");
    const r = await bulkImportGuests(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("detecta vírgula automaticamente e cria N convidados", async () => {
    prismaMock.guest.create.mockResolvedValue({ id: "g" } as never);
    const fd = new FormData();
    fd.set(
      "raw",
      [
        "Maria,11999999999,maria@test,NOIVA,Família",
        "João,,joao@test,NOIVO,Trabalho",
      ].join("\n"),
    );
    const r = await bulkImportGuests(undefined, fd);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ created: 2, skipped: 0 });
    expect(prismaMock.guest.create).toHaveBeenCalledTimes(2);
  });

  it("pula linhas sem nome", async () => {
    prismaMock.guest.create.mockResolvedValue({ id: "g" } as never);
    const fd = new FormData();
    fd.set("raw", "Maria,phone\n,sem-nome,nada");
    const r = await bulkImportGuests(undefined, fd);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data?.skipped).toBe(1);
  });

  it("respeita separador explícito TAB", async () => {
    prismaMock.guest.create.mockResolvedValue({ id: "g" } as never);
    const fd = new FormData();
    fd.set("raw", "Ana\t11\tana@x\tNOIVA");
    fd.set("separator", "TAB");
    const r = await bulkImportGuests(undefined, fd);
    expect(r.success).toBe(true);
  });
});

describe("publicRsvpRespond", () => {
  it("rejeita quando token não corresponde a guest", async () => {
    prismaMock.guest.findFirst.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("token", "abc");
    fd.set("status", "CONFIRMED");
    const r = await publicRsvpRespond(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("limita plusOnesConfirmed ao máximo permitido", async () => {
    prismaMock.guest.findFirst.mockResolvedValue({
      id: "g1",
      plusOnesAllowed: 2,
      dietary: null,
      notes: null,
    } as never);
    prismaMock.guest.update.mockResolvedValue({
      name: "Ana",
      rsvpStatus: "CONFIRMED",
    } as never);

    const fd = new FormData();
    fd.set("token", "tok");
    fd.set("status", "CONFIRMED");
    fd.set("plusOnesConfirmed", "10");
    await publicRsvpRespond(undefined, fd);

    const data = (prismaMock.guest.update.mock.calls[0][0] as { data: { plusOnesConfirmed: number } })
      .data;
    expect(data.plusOnesConfirmed).toBe(2); // capped
  });

  it("zera plusOnesConfirmed quando status=DECLINED", async () => {
    prismaMock.guest.findFirst.mockResolvedValue({
      id: "g1",
      plusOnesAllowed: 2,
      dietary: null,
      notes: null,
    } as never);
    prismaMock.guest.update.mockResolvedValue({
      name: "Ana",
      rsvpStatus: "DECLINED",
    } as never);

    const fd = new FormData();
    fd.set("token", "tok");
    fd.set("status", "DECLINED");
    fd.set("plusOnesConfirmed", "2");
    await publicRsvpRespond(undefined, fd);

    const data = (prismaMock.guest.update.mock.calls[0][0] as { data: { plusOnesConfirmed: number } })
      .data;
    expect(data.plusOnesConfirmed).toBe(0);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

import ExcelJS from "exceljs";
import {
  bulkImportGuests,
  commitGuestImport,
  createGuest,
  deleteGuest,
  previewGuestImport,
  publicRsvpRespond,
  toggleCheckin,
  updateGuest,
} from "./guestActions";
import { __resetGuestImportCache } from "@/lib/guest-import-cache";
import { __resetRateLimit } from "@/lib/rate-limit";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
  authMock.mockReset();
  authMock.mockResolvedValue({ user: { id: "test-user", role: "ADMIN" } });
  __resetGuestImportCache();
  __resetRateLimit();
});

const WEDY_HEADERS = [
  "Nome do convite",
  "Nome completo do convidado",
  "Status",
  "Telefone",
  "E-mail",
  "Tags",
  "Faixa etária",
  "Idade exata (caso for criança)",
  "Pin do convite",
];

async function wedyXlsxFile(
  rows: Array<Array<string | number>>,
  filename = "lista.xlsx",
): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(WEDY_HEADERS);
  for (const r of rows) ws.addRow(r);
  const ab = await wb.xlsx.writeBuffer();
  return new File([ab as ArrayBuffer], filename, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function importForm(file: File, source = "AUTO"): FormData {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("source", source);
  return fd;
}

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
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(((arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }) as never);
    prismaMock.guestGroup.findMany.mockResolvedValue([] as never);
    prismaMock.guestGroup.create.mockImplementation(((args: { data: { name: string } }) =>
      Promise.resolve({ id: `grp-${args.data.name}`, name: args.data.name })) as never);
  });

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
    if (r.success) expect(r.data).toEqual({ created: 2, skipped: 0, groupsCreated: 2 });
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

  it("cria GuestGroup por nome novo e associa via groupId", async () => {
    prismaMock.guest.create.mockResolvedValue({ id: "g" } as never);
    const fd = new FormData();
    fd.set(
      "raw",
      ["Maria,,,,Família Silva", "João,,,,Família Silva", "Ana,,,,Trabalho"].join("\n"),
    );

    const r = await bulkImportGuests(undefined, fd);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data?.groupsCreated).toBe(2);

    // 2 grupos únicos -> 2 chamadas
    expect(prismaMock.guestGroup.create).toHaveBeenCalledTimes(2);

    // guests recebem groupId resolvido
    const calls = prismaMock.guest.create.mock.calls.map(
      (c) => (c[0] as { data: { name: string; groupId: string | null } }).data,
    );
    const maria = calls.find((d) => d.name === "Maria");
    const joao = calls.find((d) => d.name === "João");
    const ana = calls.find((d) => d.name === "Ana");
    expect(maria?.groupId).toBe("grp-Família Silva");
    expect(joao?.groupId).toBe("grp-Família Silva");
    expect(ana?.groupId).toBe("grp-Trabalho");
  });

  it("reaproveita GuestGroup existente pelo nome", async () => {
    prismaMock.guestGroup.findMany.mockResolvedValue([
      { id: "existing-grp", name: "Família Silva" },
    ] as never);
    prismaMock.guest.create.mockResolvedValue({ id: "g" } as never);

    const fd = new FormData();
    fd.set("raw", "Maria,,,,Família Silva");
    const r = await bulkImportGuests(undefined, fd);

    expect(r.success).toBe(true);
    if (r.success) expect(r.data?.groupsCreated).toBe(0);
    expect(prismaMock.guestGroup.create).not.toHaveBeenCalled();

    const data = (prismaMock.guest.create.mock.calls[0][0] as {
      data: { groupId: string | null };
    }).data;
    expect(data.groupId).toBe("existing-grp");
  });

  it("não chama guestGroup.findMany quando nenhuma linha tem grupo", async () => {
    prismaMock.guest.create.mockResolvedValue({ id: "g" } as never);
    const fd = new FormData();
    fd.set("raw", "Maria,,,,\nJoão,,,,");
    const r = await bulkImportGuests(undefined, fd);

    expect(r.success).toBe(true);
    if (r.success) expect(r.data?.groupsCreated).toBe(0);
    expect(prismaMock.guestGroup.findMany).not.toHaveBeenCalled();
    expect(prismaMock.guestGroup.create).not.toHaveBeenCalled();
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

describe("previewGuestImport", () => {
  beforeEach(() => {
    prismaMock.guest.findMany.mockResolvedValue([] as never);
  });

  it("rejeita sem arquivo", async () => {
    const fd = new FormData();
    const r = await previewGuestImport(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("file", new File([Buffer.from("PK\x03\x04")], "x.xlsx"));
    const r = await previewGuestImport(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita arquivo que não é XLSX", async () => {
    const fd = importForm(new File([Buffer.from("hello")], "x.txt"));
    const r = await previewGuestImport(undefined, fd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/xlsx/i);
  });

  it("aceita XLSX Wedy válido e classifica linhas como new", async () => {
    const file = await wedyXlsxFile([
      ["Família A", "Ana", "Sem resposta", "", "", "Tayná", "Adulto", "", "1234"],
      ["Família A", "Bia", "Confirmado", "", "", "Padrinhos", "Adulto", "", "1234"],
    ]);
    const r = await previewGuestImport(undefined, importForm(file));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data!.source).toBe("wedy");
      expect(r.data!.totalRows).toBe(2);
      expect(r.data!.breakdown.new).toBe(2);
      expect(r.data!.tagsPreview).toEqual(["Padrinhos", "Tayná"]);
      expect(r.data!.groupsPreview).toEqual([
        { name: "Família A", count: 2, pin: "1234" },
      ]);
      expect(r.data!.importToken).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("classifica duplicate_same quando nome+grupo+phone+email batem", async () => {
    prismaMock.guest.findMany.mockResolvedValue([
      { id: "exist-1", name: "Ana", phone: "5511999990000", email: "ANA@x.com", groupName: "Família A" },
    ] as never);
    const file = await wedyXlsxFile([
      ["Família A", "Ana", "Sem resposta", "+5511 99999-0000", "ana@x.com", "", "Adulto", "", ""],
    ]);
    const r = await previewGuestImport(undefined, importForm(file));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data!.breakdown.duplicateSame).toBe(1);
      expect(r.data!.sample[0].classification).toBe("duplicate_same");
    }
  });

  it("classifica duplicate_diff quando nome bate mas dados divergem", async () => {
    prismaMock.guest.findMany.mockResolvedValue([
      { id: "exist-1", name: "Ana", phone: "11999990000", email: "ana@x.com", groupName: "Família A" },
    ] as never);
    const file = await wedyXlsxFile([
      ["Família A", "Ana", "Sem resposta", "11888880000", "outro@x.com", "", "Adulto", "", ""],
    ]);
    const r = await previewGuestImport(undefined, importForm(file));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data!.breakdown.duplicateDiff).toBe(1);
    }
  });

  it("respeita rate limit por usuário (5/min)", async () => {
    const file = await wedyXlsxFile([
      ["G", "X", "Sem resposta", "", "", "", "Adulto", "", ""],
    ]);
    let last: Awaited<ReturnType<typeof previewGuestImport>> | null = null;
    for (let i = 0; i < 6; i++) {
      last = await previewGuestImport(undefined, importForm(file));
    }
    expect(last?.success).toBe(false);
  });
});

describe("commitGuestImport", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(((arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }) as never);
    prismaMock.guestTag.findMany.mockResolvedValue([] as never);
    prismaMock.guestTag.create.mockImplementation(((args: { data: { name: string } }) =>
      Promise.resolve({ id: `tag-${args.data.name}`, name: args.data.name })) as never);
    prismaMock.guestGroup.findMany.mockResolvedValue([] as never);
    prismaMock.guestGroup.create.mockImplementation(((args: { data: { name: string; rsvpPin?: string | null } }) =>
      Promise.resolve({
        id: `grp-${args.data.name}`,
        name: args.data.name,
        rsvpPin: args.data.rsvpPin ?? null,
      })) as never);
    prismaMock.guestGroup.update.mockResolvedValue({} as never);
    prismaMock.guest.findMany.mockResolvedValue([] as never);
    prismaMock.guest.create.mockImplementation(((args: { data: { name: string } }) =>
      Promise.resolve({ id: `g-${args.data.name}` })) as never);
    prismaMock.guest.update.mockResolvedValue({} as never);
    prismaMock.guestTagOnGuest.deleteMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.guestTagOnGuest.createMany.mockResolvedValue({ count: 0 } as never);
  });

  async function uploadFile(rows: Array<Array<string | number>>): Promise<string> {
    const file = await wedyXlsxFile(rows);
    const r = await previewGuestImport(undefined, importForm(file));
    if (!r.success) throw new Error("preview failed");
    return r.data!.importToken;
  }

  it("rejeita token inválido", async () => {
    const r = await commitGuestImport({ importToken: "garbage12345", mode: "CREATE_NEW_ONLY" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/sess[aã]o/i);
  });

  it("anti-IDOR: token criado por usuário diferente não é consumido", async () => {
    const token = await uploadFile([
      ["G", "Ana", "Sem resposta", "", "", "", "Adulto", "", ""],
    ]);
    authMock.mockResolvedValue({ user: { id: "outro-user", role: "ADMIN" } });
    const r = await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });
    expect(r.success).toBe(false);
  });

  it("cria todos novos quando não há duplicatas", async () => {
    const token = await uploadFile([
      ["G", "Ana", "Sem resposta", "", "", "Tayná", "Adulto", "", "1111"],
      ["G", "Bia", "Confirmado", "", "", "Padrinhos", "Adulto", "", "1111"],
    ]);
    const r = await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({ created: 2, updated: 0, skipped: 0, groupsCreated: 1, tagsCreated: 2 });
    }
  });

  it("marca isPadrinho quando tag bate o regex flexível", async () => {
    const token = await uploadFile([
      ["G", "P1", "Sem resposta", "", "", "Padrinhos", "Adulto", "", ""],
      ["G", "P2", "Sem resposta", "", "", "madrinha", "Adulto", "", ""],
      ["G", "P3", "Sem resposta", "", "", "Florista", "Adulto", "", ""],
    ]);
    await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });
    const calls = prismaMock.guest.create.mock.calls.map(
      (c) => (c[0] as { data: { name: string; isPadrinho: boolean } }).data,
    );
    expect(calls.find((c) => c.name === "P1")?.isPadrinho).toBe(true);
    expect(calls.find((c) => c.name === "P2")?.isPadrinho).toBe(true);
    expect(calls.find((c) => c.name === "P3")?.isPadrinho).toBe(false);
  });

  it("CREATE_NEW_ONLY pula sameGroup existente", async () => {
    prismaMock.guest.findMany
      .mockResolvedValueOnce([
        { id: "exist-1", name: "Ana", phone: null, email: null, groupName: "G" },
      ] as never)
      .mockResolvedValueOnce([
        { id: "exist-1", name: "Ana", groupName: "G" },
      ] as never);
    const file = await wedyXlsxFile([
      ["G", "Ana", "Sem resposta", "", "", "", "Adulto", "", ""],
    ]);
    const preview = await previewGuestImport(undefined, importForm(file));
    if (!preview.success) throw new Error();
    const token = preview.data!.importToken;

    const r = await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data!.skipped).toBe(1);
      expect(r.data!.created).toBe(0);
    }
    expect(prismaMock.guest.update).not.toHaveBeenCalled();
  });

  it("UPSERT_BY_NAME atualiza sameGroup existente", async () => {
    prismaMock.guest.findMany
      .mockResolvedValueOnce([
        { id: "exist-1", name: "Ana", phone: null, email: null, groupName: "G" },
      ] as never)
      .mockResolvedValueOnce([
        { id: "exist-1", name: "Ana", groupName: "G" },
      ] as never);
    const file = await wedyXlsxFile([
      ["G", "Ana", "Confirmado", "+5511999990000", "ana@x.com", "Padrinhos", "Adulto", "", ""],
    ]);
    const preview = await previewGuestImport(undefined, importForm(file));
    if (!preview.success) throw new Error();
    const r = await commitGuestImport({
      importToken: preview.data!.importToken,
      mode: "UPSERT_BY_NAME",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data!.updated).toBe(1);

    const upd = prismaMock.guest.update.mock.calls[0][0] as {
      where: { id: string };
      data: { rsvpStatus: string; isPadrinho?: boolean };
    };
    expect(upd.where.id).toBe("exist-1");
    expect(upd.data.rsvpStatus).toBe("CONFIRMED");
    expect(upd.data.isPadrinho).toBe(true);
  });

  it("CREATE_ALL_DUPLICATES sempre cria, mesmo com match no mesmo grupo", async () => {
    prismaMock.guest.findMany
      .mockResolvedValueOnce([
        { id: "exist-1", name: "Ana", phone: null, email: null, groupName: "G" },
      ] as never)
      .mockResolvedValueOnce([
        { id: "exist-1", name: "Ana", groupName: "G" },
      ] as never);
    const file = await wedyXlsxFile([
      ["G", "Ana", "Sem resposta", "", "", "", "Adulto", "", ""],
    ]);
    const preview = await previewGuestImport(undefined, importForm(file));
    if (!preview.success) throw new Error();
    const r = await commitGuestImport({
      importToken: preview.data!.importToken,
      mode: "CREATE_ALL_DUPLICATES",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data!.created).toBe(1);
      expect(r.data!.skipped).toBe(0);
      expect(r.data!.updated).toBe(0);
    }
  });

  it("reaproveita GuestTag existente (case-insensitive)", async () => {
    prismaMock.guestTag.findMany.mockResolvedValueOnce([
      { id: "existing-tag", name: "Padrinhos" },
    ] as never);
    const token = await uploadFile([
      ["G", "X", "Sem resposta", "", "", "padrinhos", "Adulto", "", ""],
    ]);
    const r = await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });
    expect(r.success).toBe(true);
    expect(prismaMock.guestTag.create).not.toHaveBeenCalled();
    const linkCall = prismaMock.guestTagOnGuest.createMany.mock.calls[0][0] as {
      data: Array<{ tagId: string }>;
    };
    expect(linkCall.data[0].tagId).toBe("existing-tag");
  });

  it("propaga rsvpPin para grupo novo", async () => {
    const token = await uploadFile([
      ["Família X", "Ana", "Sem resposta", "", "", "", "Adulto", "", "9876"],
    ]);
    await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });
    const call = prismaMock.guestGroup.create.mock.calls[0][0] as {
      data: { name: string; rsvpPin: string | null };
    };
    expect(call.data.rsvpPin).toBe("9876");
  });

  it("não sobrescreve rsvpPin existente non-null", async () => {
    prismaMock.guestGroup.findMany.mockResolvedValueOnce([
      { id: "g1", name: "Família X", rsvpPin: "0000" },
    ] as never);
    const token = await uploadFile([
      ["Família X", "Ana", "Sem resposta", "", "", "", "Adulto", "", "9999"],
    ]);
    await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });
    expect(prismaMock.guestGroup.update).not.toHaveBeenCalled();
  });

  it("atualiza rsvpPin quando grupo existente tem pin null", async () => {
    prismaMock.guestGroup.findMany.mockResolvedValueOnce([
      { id: "g1", name: "Família X", rsvpPin: null },
    ] as never);
    const token = await uploadFile([
      ["Família X", "Ana", "Sem resposta", "", "", "", "Adulto", "", "9999"],
    ]);
    await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });
    expect(prismaMock.guestGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { rsvpPin: "9999" },
    });
  });

  it("grava audit BULK_CREATE com source e mode", async () => {
    const token = await uploadFile([
      ["G", "Ana", "Sem resposta", "", "", "", "Adulto", "", ""],
    ]);
    await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });
    const auditCall = prismaMock.auditLog.create.mock.calls.find((c) => {
      const data = (c[0] as { data: { action?: string } }).data;
      return data.action === "BULK_CREATE";
    });
    expect(auditCall).toBeTruthy();
    const payload = (auditCall![0] as { data: { payload?: string } }).data.payload;
    expect(payload).toContain('"source":"wedy"');
    expect(payload).toContain('"mode":"CREATE_NEW_ONLY"');
  });

  it("Wedy: phone/email vão para GuestGroup.contact* e Guest.phone fica null (contactsBelongToGroup)", async () => {
    const token = await uploadFile([
      ["Família X", "Ana", "Sem resposta", "+5511999990000", "ana@x.com", "", "Adulto", "", ""],
      ["Família X", "Bia", "Sem resposta", "", "", "", "Adulto", "", ""],
    ]);
    await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });

    const grpCall = prismaMock.guestGroup.create.mock.calls[0][0] as {
      data: { name: string; contactPhone: string | null; contactEmail: string | null; contactName: string | null };
    };
    expect(grpCall.data).toMatchObject({
      name: "Família X",
      contactPhone: "+5511999990000",
      contactEmail: "ana@x.com",
      contactName: "Ana",
    });

    const guestCalls = prismaMock.guest.create.mock.calls.map(
      (c) => (c[0] as { data: { name: string; phone: string | null; email: string | null } }).data,
    );
    for (const g of guestCalls) {
      expect(g.phone).toBeNull();
      expect(g.email).toBeNull();
    }
  });

  it("Wedy: não sobrescreve contactPhone/contactEmail existente non-null do grupo", async () => {
    prismaMock.guestGroup.findMany.mockResolvedValueOnce([
      {
        id: "g1",
        name: "Família X",
        rsvpPin: null,
        contactPhone: "0000",
        contactEmail: "old@x.com",
        contactName: "Antigo",
      },
    ] as never);
    const token = await uploadFile([
      ["Família X", "Ana", "Sem resposta", "+5511999990000", "novo@x.com", "", "Adulto", "", ""],
    ]);
    await commitGuestImport({ importToken: token, mode: "CREATE_NEW_ONLY" });
    expect(prismaMock.guestGroup.update).not.toHaveBeenCalled();
  });
});

describe("previewGuestImport (internal CSV)", () => {
  beforeEach(() => {
    prismaMock.guest.findMany.mockResolvedValue([] as never);
  });

  function csvFile(text: string, filename = "export.csv"): File {
    return new File([text], filename, { type: "text/csv" });
  }

  function importForm(file: File, source = "AUTO"): FormData {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("source", source);
    return fd;
  }

  it("detecta CSV interno pelo header e classifica linhas", async () => {
    const csv = [
      "Nome,Telefone,Email,Lado,Grupo,Status,+1 confirmados,Mesa,Restrições,Cidade,Padrinho,VIP,Criança",
      `"Maria","11999","maria@x","NOIVA","Família A","Confirmado","2","5","","São Paulo","sim","","" `,
      `"João","","","NOIVO","Família A","Convidado","0","","","","","",""`,
    ].join("\n");

    const r = await previewGuestImport(undefined, importForm(csvFile(csv)));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data!.source).toBe("internal-csv");
      expect(r.data!.totalRows).toBe(2);
      expect(r.data!.breakdown.new).toBe(2);
      expect(r.data!.tagsPreview).toContain("Padrinhos");
    }
  });

  it("rejeita arquivo .csv sem nenhum header reconhecido", async () => {
    const csv = "x,y,z\n1,2,3";
    const r = await previewGuestImport(undefined, importForm(csvFile(csv)));
    expect(r.success).toBe(false);
  });
});

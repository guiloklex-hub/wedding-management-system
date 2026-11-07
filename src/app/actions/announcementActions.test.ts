import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";
import { newAnnouncementConfig } from "@/lib/notifications/announcement-config";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1", role: "ADMIN" } })),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
}));
const armMock = vi.fn();
vi.mock("@/lib/notifications/broadcast-worker", () => ({ armBroadcastWorker: () => armMock() }));
vi.mock("@/lib/notifications/whatsapp", () => ({ getWhatsAppStatus: () => ({ state: "CONNECTED" }) }));
vi.mock("@/lib/notifications/email", () => ({ isEmailConfigured: () => true }));
const removeUploadMock = vi.fn();
vi.mock("@/lib/storage", () => ({
  readUpload: vi.fn(async () => Buffer.from("x")),
  removeUpload: (...a: unknown[]) => removeUploadMock(...a),
  saveUpload: vi.fn(),
}));

const context = {
  coupleNames: "Ana & Beto",
  eventDate: "2026-12-12T00:00:00.000Z",
  venueName: null,
  siteUrl: null,
  registryUrl: null,
  rsvpMode: "NATIVE" as const,
  externalRsvpUrl: null,
  appUrl: "http://localhost:3005",
  defaultLocale: "pt-BR",
};
vi.mock("@/lib/notifications/announcement", () => ({
  buildAnnouncementContext: vi.fn(async () => context),
  loadAnnouncementSources: vi.fn(async () => ({
    groups: [{ id: "g1", name: "Família", contactPhone: "11911112222", contactEmail: null, hasPin: true }],
    guests: [
      { id: "a", name: "Ana", groupId: "g1", rsvpStatus: "CONFIRMED", side: null, isPadrinho: false, tagIds: [], language: null, phone: null, email: null, hasPin: true },
      { id: "b", name: "Beto", groupId: "g1", rsvpStatus: "INVITED", side: null, isPadrinho: false, tagIds: [], language: null, phone: null, email: null, hasPin: true },
      { id: "c", name: "Caio", groupId: null, rsvpStatus: "CONFIRMED", side: null, isPadrinho: false, tagIds: [], language: null, phone: "11922223333", email: null, hasPin: false },
      { id: "d", name: "Duda", groupId: null, rsvpStatus: "CONFIRMED", side: null, isPadrinho: false, tagIds: [], language: null, phone: "11933334444", email: null, hasPin: true },
    ],
  })),
  loadRsvpSecrets: vi.fn(async () => new Map([["GuestGroup:g1", { token: "tok-g1", pin: "4321" }]])),
  readAnnouncementMedia: vi.fn(async () => undefined),
  sendAnnouncement: vi.fn(),
}));

import {
  deleteAnnouncementDraft,
  saveAnnouncementDraft,
  startAnnouncement,
} from "./announcementActions";

function stored(status: string, overrides: Partial<ReturnType<typeof newAnnouncementConfig>> = {}) {
  const config = { ...newAnnouncementConfig("Aviso"), message: "Oi {convidados}", ...overrides };
  return {
    id: "ann1",
    status,
    startedAt: null,
    payloadJson: JSON.stringify({ version: 1, kind: "ANNOUNCEMENT", config, context: null }),
  };
}

function draftForm(extra: Record<string, unknown> = {}) {
  const fd = new FormData();
  fd.append("id", "ann1");
  fd.append(
    "payload",
    JSON.stringify({
      title: "Lembrete",
      message: "Traje esporte fino",
      channel: "AUTO",
      audience: { rsvpStatuses: ["CONFIRMED"] },
      excludedRefs: [],
      ...extra,
    }),
  );
  return fd;
}

beforeEach(() => {
  prismaMock.auditLog.create.mockResolvedValue({} as never);
  removeUploadMock.mockReset();
  armMock.mockReset();
});

describe("saveAnnouncementDraft", () => {
  it("ignora caminho de arte enviado pelo client", async () => {
    prismaMock.broadcast.findFirst.mockResolvedValue(stored("DRAFT") as never);
    prismaMock.broadcast.updateMany.mockResolvedValue({ count: 1 } as never);

    const res = await saveAnnouncementDraft(undefined, draftForm({ art: { path: "contract/x/y.pdf", mime: "application/pdf", name: "y.pdf" } }));
    expect(res.success).toBe(true);
    const data = prismaMock.broadcast.updateMany.mock.calls[0][0].data as { payloadJson: string };
    expect(JSON.parse(data.payloadJson).config.art).toBeNull();
  });

  it("recusa salvar aviso que não é rascunho", async () => {
    prismaMock.broadcast.findFirst.mockResolvedValue(stored("SENDING") as never);
    const res = await saveAnnouncementDraft(undefined, draftForm());
    expect(res).toMatchObject({ success: false });
    expect(prismaMock.broadcast.updateMany).not.toHaveBeenCalled();
  });

  it("corrida: se o rascunho saiu de DRAFT no meio, retorna erro", async () => {
    prismaMock.broadcast.findFirst.mockResolvedValue(stored("DRAFT") as never);
    prismaMock.broadcast.updateMany.mockResolvedValue({ count: 0 } as never);
    const res = await saveAnnouncementDraft(undefined, draftForm());
    expect(res.success).toBe(false);
  });

  it("rejeita payload inválido", async () => {
    const fd = new FormData();
    fd.append("id", "ann1");
    fd.append("payload", "{not json");
    expect((await saveAnnouncementDraft(undefined, fd)).success).toBe(false);
  });
});

describe("deleteAnnouncementDraft", () => {
  it("não exclui aviso já enviado", async () => {
    prismaMock.broadcast.findFirst.mockResolvedValue(stored("DONE") as never);
    prismaMock.broadcast.deleteMany.mockResolvedValue({ count: 0 } as never);
    const res = await deleteAnnouncementDraft("ann1");
    expect(res.success).toBe(false);
    expect(removeUploadMock).not.toHaveBeenCalled();
  });
});

describe("startAnnouncement", () => {
  it("recusa iniciar aviso que não é rascunho", async () => {
    prismaMock.broadcast.findFirst.mockResolvedValueOnce(stored("DONE") as never);
    const res = await startAnnouncement("ann1");
    expect(res.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("enfileira só confirmados, respeita exclusão manual e congela o contexto", async () => {
    prismaMock.broadcast.findFirst
      .mockResolvedValueOnce(stored("DRAFT", { excludedRefs: ["Guest:d"] }) as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "ann1", status: "SENDING", total: 2, startedAt: new Date() } as never);
    (prismaMock.broadcastRecipient.groupBy as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue([]);
    prismaMock.broadcastRecipient.count.mockResolvedValue(0);
    prismaMock.broadcast.count.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (cb: unknown) => {
      prismaMock.broadcast.updateMany.mockResolvedValue({ count: 1 } as never);
      prismaMock.broadcastRecipient.createMany.mockResolvedValue({ count: 2 } as never);
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock);
    });

    const res = await startAnnouncement("ann1");
    expect(res.success).toBe(true);

    const claim = prismaMock.broadcast.updateMany.mock.calls[0][0];
    expect(claim.where).toEqual({ id: "ann1", kind: "ANNOUNCEMENT", status: "DRAFT" });
    expect(JSON.parse((claim.data as { payloadJson: string }).payloadJson).context).toEqual(context);

    const created = prismaMock.broadcastRecipient.createMany.mock.calls[0][0]?.data as Array<{
      refId: string;
      memberNames: string;
      status: string;
      payloadJson: string;
    }>;
    expect(created.map((r) => r.refId)).toEqual(["g1", "c"]);
    expect(created[0].memberNames).toBe("Ana");
    expect(JSON.parse(created[0].payloadJson)).toMatchObject({
      rsvpLink: "http://localhost:3005/rsvp/group/tok-g1",
      pin: "4321",
    });
    expect(armMock).toHaveBeenCalled();
  });

  it("transação que perde a corrida do DRAFT devolve erro", async () => {
    prismaMock.broadcast.findFirst.mockResolvedValueOnce(stored("DRAFT") as never).mockResolvedValueOnce(null);
    prismaMock.$transaction.mockImplementation(async (cb: unknown) => {
      prismaMock.broadcast.updateMany.mockResolvedValue({ count: 0 } as never);
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock);
    });
    const res = await startAnnouncement("ann1");
    expect(res.success).toBe(false);
    expect(armMock).not.toHaveBeenCalled();
  });

  it("texto com {pin} pula quem não tem PIN", async () => {
    prismaMock.broadcast.findFirst
      .mockResolvedValueOnce(stored("DRAFT", { message: "PIN {pin}" }) as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (cb: unknown) => {
      prismaMock.broadcast.updateMany.mockResolvedValue({ count: 1 } as never);
      prismaMock.broadcastRecipient.createMany.mockResolvedValue({ count: 3 } as never);
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock);
    });
    await startAnnouncement("ann1");
    const created = prismaMock.broadcastRecipient.createMany.mock.calls[0][0]?.data as Array<{
      refId: string;
      status: string;
      error: string | null;
    }>;
    expect(created.find((r) => r.refId === "c")).toMatchObject({ status: "SKIPPED", error: "NO_PIN" });
  });
});

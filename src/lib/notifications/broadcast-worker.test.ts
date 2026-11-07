import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const sendAnnouncementMock = vi.fn();
const loadCtxMock = vi.fn();
vi.mock("./announcement", () => ({
  sendAnnouncement: (...a: unknown[]) => sendAnnouncementMock(...a),
  loadAnnouncementContextFromPayload: (...a: unknown[]) => loadCtxMock(...a),
}));

import { processOne } from "./broadcast-worker";

const recipientPayload = {
  version: 1,
  refType: "GuestGroup",
  refId: "g1",
  memberNames: "Ana e Beto",
  locale: "pt-BR",
  phone: "+5511911112222",
  email: null,
  rsvpLink: null,
  pin: null,
};

function arrange(broadcastId: string, recipientJson: string | null) {
  prismaMock.broadcast.findFirst.mockResolvedValue({
    id: broadcastId,
    kind: "ANNOUNCEMENT",
    status: "SENDING",
    payloadJson: "{}",
  } as never);
  prismaMock.broadcastRecipient.findFirst.mockResolvedValue({
    id: "r1",
    broadcastId,
    status: "PENDING",
    payloadJson: recipientJson,
  } as never);
  prismaMock.broadcastRecipient.updateMany.mockResolvedValue({ count: 1 } as never);
  prismaMock.broadcastRecipient.update.mockResolvedValue({} as never);
}

beforeEach(() => {
  sendAnnouncementMock.mockReset();
  loadCtxMock.mockReset();
  loadCtxMock.mockResolvedValue({ ok: true, ctx: { config: {}, context: {} } });
});

describe("broadcast-worker — ANNOUNCEMENT", () => {
  it("envia e marca SENT com o canal usado", async () => {
    arrange("b1", JSON.stringify(recipientPayload));
    sendAnnouncementMock.mockResolvedValue({ ok: true, channelUsed: "WHATSAPP" });

    expect(await processOne()).toBe("SENT");
    expect(sendAnnouncementMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: expect.objectContaining({ refId: "g1" }) }),
    );
    expect(prismaMock.broadcastRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: expect.objectContaining({ status: "SENT", channelUsed: "WHATSAPP", error: null }),
      }),
    );
  });

  it("payload de destinatário inválido vira FAILED sem enviar", async () => {
    arrange("b2", JSON.stringify({ ...recipientPayload, version: 2 }));
    expect(await processOne()).toBe("FAILED");
    expect(sendAnnouncementMock).not.toHaveBeenCalled();
    expect(prismaMock.broadcastRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ error: "INVALID_RECIPIENT_PAYLOAD" }) }),
    );
  });

  it("snapshot inválido vira FAILED com o código do erro", async () => {
    arrange("b3", JSON.stringify(recipientPayload));
    loadCtxMock.mockResolvedValue({ ok: false, error: "INVALID_SNAPSHOT" });
    expect(await processOne()).toBe("FAILED");
    expect(prismaMock.broadcastRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ error: "INVALID_SNAPSHOT" }) }),
    );
  });
});

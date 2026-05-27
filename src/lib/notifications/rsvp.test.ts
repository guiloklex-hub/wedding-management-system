import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const notifyMock = vi.fn();
vi.mock("./index", () => ({ notify: (...args: unknown[]) => notifyMock(...args) }));

import { notifyRsvpResponse } from "./rsvp";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  notifyMock.mockReset();
  notifyMock.mockResolvedValue({});
});

describe("notifyRsvpResponse", () => {
  it("não notifica quando já houve envio hoje (dedupe diário)", async () => {
    prismaMock.notificationLog.count.mockResolvedValue(1 as never);
    await notifyRsvpResponse({
      refType: "Guest",
      refId: "g1",
      guestName: "Ana",
      rsvpStatus: "CONFIRMED",
    });
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("notifica cada gestor/noivo ativo com o kind e refId corretos", async () => {
    prismaMock.notificationLog.count.mockResolvedValue(0 as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", name: "Noivo", email: "noivo@x.com", locale: "pt-BR" },
      { id: "u2", name: "Noiva", email: "noiva@x.com", locale: "en" },
    ] as never);

    await notifyRsvpResponse({
      refType: "Guest",
      refId: "g1",
      guestName: "Ana",
      rsvpStatus: "CONFIRMED",
      plusOnes: 1,
    });

    expect(notifyMock).toHaveBeenCalledTimes(2);
    const [, input, opts] = notifyMock.mock.calls[0];
    expect((input as { kind: string }).kind).toBe("GUEST_RSVP");
    expect((input as { guestName: string }).guestName).toBe("Ana");
    expect(opts).toEqual({ refType: "Guest", refId: "g1" });
  });
});

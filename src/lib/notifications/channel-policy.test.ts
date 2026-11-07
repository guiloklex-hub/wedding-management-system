import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NotifyResult } from "./index";

const notifyMock = vi.fn();
vi.mock("./index", () => ({
  notify: (...args: unknown[]) => notifyMock(...args),
}));

import { deliverByChannel } from "./channel-policy";
import type { RenderInput } from "./templates";

function res(over: { wa?: Partial<NotifyResult["whatsapp"]>; email?: Partial<NotifyResult["email"]> }): NotifyResult {
  return {
    whatsapp: { attempted: true, ok: false, ...over.wa },
    email: { attempted: true, ok: false, ...over.email },
  };
}

const input = { kind: "ADMIN_TEST", locale: "pt-BR" } as unknown as RenderInput;
const base = { input, locale: "pt-BR" as const, refType: "Guest", refId: "g1" };

beforeEach(() => notifyMock.mockReset());

describe("deliverByChannel", () => {
  it("AUTO: WhatsApp com sucesso não tenta e-mail", async () => {
    notifyMock.mockResolvedValueOnce(res({ wa: { ok: true } }));
    const out = await deliverByChannel({ ...base, policy: "AUTO", phone: "+5511911112222", email: "a@x.com" });
    expect(out).toEqual({ ok: true, channelUsed: "WHATSAPP" });
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0][0]).toEqual({ phone: "+5511911112222", locale: "pt-BR" });
  });

  it("AUTO: WhatsApp falha e cai para e-mail", async () => {
    notifyMock
      .mockResolvedValueOnce(res({ wa: { error: "offline" } }))
      .mockResolvedValueOnce(res({ email: { ok: true } }));
    const out = await deliverByChannel({ ...base, policy: "AUTO", phone: "+5511911112222", email: "a@x.com" });
    expect(out).toEqual({ ok: true, channelUsed: "EMAIL" });
    expect(notifyMock.mock.calls[1][0]).toEqual({ email: "a@x.com", locale: "pt-BR" });
  });

  it("AUTO: ambos falham com mensagem combinada", async () => {
    notifyMock
      .mockResolvedValueOnce(res({ wa: { error: "wa" } }))
      .mockResolvedValueOnce(res({ email: { error: "smtp" } }));
    const out = await deliverByChannel({ ...base, policy: "AUTO", phone: "+5511911112222", email: "a@x.com" });
    expect(out).toEqual({ ok: false, error: "WhatsApp: wa; Email: smtp" });
  });

  it("AUTO: só e-mail disponível", async () => {
    notifyMock.mockResolvedValueOnce(res({ email: { ok: true } }));
    const out = await deliverByChannel({ ...base, policy: "AUTO", phone: null, email: "a@x.com" });
    expect(out).toEqual({ ok: true, channelUsed: "EMAIL" });
  });

  it("AUTO: sem contato", async () => {
    const out = await deliverByChannel({ ...base, policy: "AUTO", phone: null, email: null });
    expect(out).toEqual({ ok: false, error: "NO_CONTACT" });
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("WHATSAPP sem telefone e EMAIL sem e-mail", async () => {
    expect(await deliverByChannel({ ...base, policy: "WHATSAPP", phone: null, email: "a@x.com" })).toEqual({
      ok: false,
      error: "NO_PHONE",
    });
    expect(await deliverByChannel({ ...base, policy: "EMAIL", phone: "+5511911112222", email: null })).toEqual({
      ok: false,
      error: "NO_EMAIL",
    });
  });

  it("WHATSAPP falhando não cai para e-mail", async () => {
    notifyMock.mockResolvedValueOnce(res({ wa: {} }));
    const out = await deliverByChannel({ ...base, policy: "WHATSAPP", phone: "+5511911112222", email: "a@x.com" });
    expect(out).toEqual({ ok: false, error: "WHATSAPP_FAILED" });
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it("repassa refType, refId e mídia ao notify", async () => {
    notifyMock.mockResolvedValueOnce(res({ email: { ok: true } }));
    const media = { data: Buffer.from("x"), mimeType: "image/png", filename: "a.png" };
    await deliverByChannel({ ...base, policy: "EMAIL", phone: null, email: "a@x.com", media });
    expect(notifyMock.mock.calls[0][2]).toEqual({ refType: "Guest", refId: "g1", media });
  });
});

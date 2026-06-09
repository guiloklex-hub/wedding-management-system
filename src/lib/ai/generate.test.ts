import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const getAiClientMock = vi.fn();
const isAiEnabledMock = vi.fn();
const getAiConfigMock = vi.fn();
const checkRateMock = vi.fn();

vi.mock("./client", () => ({ getAiClient: () => getAiClientMock() }));
vi.mock("./config", () => ({
  isAiEnabled: () => isAiEnabledMock(),
  getAiConfig: () => getAiConfigMock(),
}));
vi.mock("./rate-limit", () => ({ checkAiRateLimit: () => checkRateMock() }));

import { generateText, generateStructured } from "./generate";

type FakeResponse = {
  text?: string;
  candidates?: Array<{ finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

function clientReturning(response: FakeResponse) {
  return { models: { generateContent: vi.fn().mockResolvedValue(response) } };
}

function clientThrowing(err: Error) {
  return { models: { generateContent: vi.fn().mockRejectedValue(err) } };
}

beforeEach(() => {
  isAiEnabledMock.mockReturnValue(true);
  getAiConfigMock.mockReturnValue({
    apiKey: "k",
    model: "gemini-2.5-flash",
    timeoutMs: 20_000,
    maxOutputTokens: 2048,
  });
  checkRateMock.mockReturnValue({ ok: true, resetAt: 0 });
  getAiClientMock.mockReset();
});

describe("generateText", () => {
  it("retorna texto e uso no sucesso", async () => {
    getAiClientMock.mockReturnValue(
      clientReturning({
        text: "tudo certo",
        candidates: [{ finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
      }),
    );
    const r = await generateText("p", { userId: "u", resource: "r" });
    expect(r).toEqual({ ok: true, data: "tudo certo", usage: { inputTokens: 5, outputTokens: 3 } });
  });

  it("DISABLED quando a IA está desligada", async () => {
    isAiEnabledMock.mockReturnValue(false);
    const r = await generateText("p", { userId: "u", resource: "r" });
    expect(r).toEqual({ ok: false, code: "DISABLED" });
  });

  it("RATE_LIMITED quando estoura o bucket", async () => {
    checkRateMock.mockReturnValue({ ok: false, resetAt: 0 });
    const r = await generateText("p", { userId: "u", resource: "r" });
    expect(r).toEqual({ ok: false, code: "RATE_LIMITED" });
  });

  it("BLOCKED quando finishReason é de segurança", async () => {
    getAiClientMock.mockReturnValue(
      clientReturning({ text: "x", candidates: [{ finishReason: "SAFETY" }] }),
    );
    const r = await generateText("p", { userId: "u", resource: "r" });
    expect(r).toEqual({ ok: false, code: "BLOCKED" });
  });

  it("PROVIDER_ERROR quando texto vazio", async () => {
    getAiClientMock.mockReturnValue(
      clientReturning({ text: "", candidates: [{ finishReason: "STOP" }] }),
    );
    const r = await generateText("p", { userId: "u", resource: "r" });
    expect(r).toEqual({ ok: false, code: "PROVIDER_ERROR" });
  });

  it("TIMEOUT quando a chamada aborta", async () => {
    const err = new Error("aborted");
    err.name = "TimeoutError";
    getAiClientMock.mockReturnValue(clientThrowing(err));
    const r = await generateText("p", { userId: "u", resource: "r" });
    expect(r).toEqual({ ok: false, code: "TIMEOUT" });
  });

  it("PROVIDER_ERROR em erro genérico", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getAiClientMock.mockReturnValue(clientThrowing(new Error("boom")));
    const r = await generateText("p", { userId: "u", resource: "r" });
    expect(r).toEqual({ ok: false, code: "PROVIDER_ERROR" });
  });
});

describe("generateStructured", () => {
  const schema = z.object({ n: z.number() });

  it("parseia e valida JSON", async () => {
    getAiClientMock.mockReturnValue(
      clientReturning({ text: '{"n":1}', candidates: [{ finishReason: "STOP" }] }),
    );
    const r = await generateStructured("p", schema, { userId: "u", resource: "r" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ n: 1 });
  });

  it("INVALID_OUTPUT em JSON malformado", async () => {
    getAiClientMock.mockReturnValue(
      clientReturning({ text: "não é json", candidates: [{ finishReason: "STOP" }] }),
    );
    const r = await generateStructured("p", schema, { userId: "u", resource: "r" });
    expect(r).toEqual({ ok: false, code: "INVALID_OUTPUT" });
  });

  it("INVALID_OUTPUT quando o schema falha", async () => {
    getAiClientMock.mockReturnValue(
      clientReturning({ text: '{"n":"x"}', candidates: [{ finishReason: "STOP" }] }),
    );
    const r = await generateStructured("p", schema, { userId: "u", resource: "r" });
    expect(r).toEqual({ ok: false, code: "INVALID_OUTPUT" });
  });
});

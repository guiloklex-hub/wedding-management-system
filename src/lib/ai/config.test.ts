import { describe, it, expect, afterEach } from "vitest";
import { getAiConfig, getAiModel, isAiEnabled } from "./config";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("isAiEnabled", () => {
  it("é false sem GEMINI_API_KEY", () => {
    delete process.env.GEMINI_API_KEY;
    expect(isAiEnabled()).toBe(false);
  });

  it("é true com GEMINI_API_KEY", () => {
    process.env.GEMINI_API_KEY = "k";
    expect(isAiEnabled()).toBe(true);
  });
});

describe("getAiConfig", () => {
  it("retorna null sem chave", () => {
    delete process.env.GEMINI_API_KEY;
    expect(getAiConfig()).toBeNull();
  });

  it("usa defaults quando há chave e sem overrides", () => {
    process.env.GEMINI_API_KEY = "k";
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_TIMEOUT_MS;
    delete process.env.GEMINI_MAX_OUTPUT_TOKENS;
    expect(getAiConfig()).toEqual({
      apiKey: "k",
      model: "gemini-2.5-flash",
      timeoutMs: 20_000,
      maxOutputTokens: 2048,
    });
  });

  it("honra overrides de env", () => {
    process.env.GEMINI_API_KEY = "k";
    process.env.GEMINI_MODEL = "gemini-2.5-flash-lite";
    process.env.GEMINI_TIMEOUT_MS = "5000";
    process.env.GEMINI_MAX_OUTPUT_TOKENS = "512";
    expect(getAiConfig()).toEqual({
      apiKey: "k",
      model: "gemini-2.5-flash-lite",
      timeoutMs: 5000,
      maxOutputTokens: 512,
    });
  });

  it("cai para default quando env numérico é inválido", () => {
    process.env.GEMINI_API_KEY = "k";
    process.env.GEMINI_TIMEOUT_MS = "abc";
    process.env.GEMINI_MAX_OUTPUT_TOKENS = "-3";
    const cfg = getAiConfig();
    expect(cfg?.timeoutMs).toBe(20_000);
    expect(cfg?.maxOutputTokens).toBe(2048);
  });
});

describe("getAiModel", () => {
  it("default sem env", () => {
    delete process.env.GEMINI_MODEL;
    expect(getAiModel()).toBe("gemini-2.5-flash");
  });

  it("usa GEMINI_MODEL quando definido", () => {
    process.env.GEMINI_MODEL = "gemini-2.5-pro";
    expect(getAiModel()).toBe("gemini-2.5-pro");
  });
});

import { describe, it, expect } from "vitest";
import { getClientIp, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("permite até max chamadas dentro da janela", () => {
    const key = `t-${Math.random()}`;
    expect(rateLimit(key, 3, 1000).ok).toBe(true);
    expect(rateLimit(key, 3, 1000).ok).toBe(true);
    expect(rateLimit(key, 3, 1000).ok).toBe(true);
    expect(rateLimit(key, 3, 1000).ok).toBe(false);
  });

  it("chaves diferentes não interferem", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, 1, 1000).ok).toBe(true);
    expect(rateLimit(b, 1, 1000).ok).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prioriza cf-connecting-ip", () => {
    const h = new Headers({
      "cf-connecting-ip": "1.2.3.4",
      "x-forwarded-for": "5.6.7.8, 9.10.11.12",
    });
    expect(getClientIp(h)).toBe("1.2.3.4");
  });

  it("usa último hop de x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "5.6.7.8, 9.10.11.12" });
    expect(getClientIp(h)).toBe("9.10.11.12");
  });

  it("retorna 'unknown' se nenhum header presente", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

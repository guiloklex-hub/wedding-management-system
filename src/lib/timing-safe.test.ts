import { describe, it, expect } from "vitest";
import { timingSafeEquals } from "./timing-safe";

describe("timingSafeEquals", () => {
  it("retorna true para strings iguais", () => {
    expect(timingSafeEquals("secret-token-123", "secret-token-123")).toBe(true);
  });

  it("retorna false para strings diferentes", () => {
    expect(timingSafeEquals("aaa", "bbb")).toBe(false);
  });

  it("retorna false para strings de tamanhos diferentes (sem lançar)", () => {
    expect(timingSafeEquals("short", "much-longer-string")).toBe(false);
  });

  it("trata string vazia", () => {
    expect(timingSafeEquals("", "")).toBe(true);
    expect(timingSafeEquals("", "x")).toBe(false);
  });
});

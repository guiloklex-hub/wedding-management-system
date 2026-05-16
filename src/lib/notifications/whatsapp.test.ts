import { describe, it, expect } from "vitest";
import { backoffDelay } from "./whatsapp";

describe("backoffDelay", () => {
  it("retorna o piso de 3s para 0 ou tentativas negativas", () => {
    expect(backoffDelay(0)).toBe(3000);
    expect(backoffDelay(-1)).toBe(3000);
  });

  it("dobra o atraso a cada tentativa", () => {
    expect(backoffDelay(1)).toBe(3000);
    expect(backoffDelay(2)).toBe(6000);
    expect(backoffDelay(3)).toBe(12_000);
    expect(backoffDelay(4)).toBe(24_000);
    expect(backoffDelay(5)).toBe(48_000);
  });

  it("limita o atraso em 60s", () => {
    expect(backoffDelay(6)).toBe(60_000);
    expect(backoffDelay(7)).toBe(60_000);
    expect(backoffDelay(20)).toBe(60_000);
  });
});

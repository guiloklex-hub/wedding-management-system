import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodErrorMessage } from "./zod-i18n";

const t = (key: string) => `T(${key})`;

describe("zodErrorMessage", () => {
  it("usa custom message quando provida", () => {
    const schema = z.string().min(5, "Mínimo 5");
    const r = schema.safeParse("a");
    if (r.success) throw new Error("expected failure");
    expect(zodErrorMessage(r.error, t)).toBe("Mínimo 5");
  });

  it("cai em key de tradução para mensagem default 'String must contain at least'", () => {
    const schema = z.string().min(5);
    const r = schema.safeParse("a");
    if (r.success) throw new Error("expected failure");
    const out = zodErrorMessage(r.error, t);
    expect(out).toBe("T(zod.tooShort)");
  });

  it("invalid_type → zod.required", () => {
    const schema = z.object({ name: z.string() });
    const r = schema.safeParse({});
    if (r.success) throw new Error("expected failure");
    const out = zodErrorMessage(r.error, t);
    expect(out).toBe("T(zod.required)");
  });

  it("invalid_format email → zod.invalidEmail", () => {
    const schema = z.string().email();
    const r = schema.safeParse("not-email");
    if (r.success) throw new Error("expected failure");
    const out = zodErrorMessage(r.error, t);
    expect(out).toBe("T(zod.invalidEmail)");
  });
});

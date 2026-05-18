import { describe, it, expect } from "vitest";
import { generateSecret, generateSync } from "otplib";
import {
  checkBackupCode,
  createTotpSetup,
  generateBackupCodes,
  verifyTotpToken,
} from "./totp";

describe("generateBackupCodes", () => {
  it("retorna a quantidade pedida", () => {
    expect(generateBackupCodes(5)).toHaveLength(5);
  });

  it("default é 8", () => {
    expect(generateBackupCodes()).toHaveLength(8);
  });

  it("formato XXXXX-XXXXX (5+5 hex com traço)", () => {
    for (const code of generateBackupCodes(10)) {
      expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
    }
  });

  it("códigos são distintos (randomBytes)", () => {
    const codes = generateBackupCodes(20);
    expect(new Set(codes).size).toBeGreaterThan(10);
  });
});

describe("verifyTotpToken", () => {
  it("rejeita string não-numérica", () => {
    expect(verifyTotpToken("abc123", "ANYSECRET")).toBe(false);
  });

  it("rejeita comprimento diferente de 6", () => {
    expect(verifyTotpToken("12345", "ANYSECRET")).toBe(false);
    expect(verifyTotpToken("1234567", "ANYSECRET")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(verifyTotpToken("", "ANYSECRET")).toBe(false);
  });

  it("aceita token válido gerado a partir do mesmo secret", () => {
    const secret = generateSecret();
    const token = generateSync({ secret });
    expect(verifyTotpToken(token, secret)).toBe(true);
  });

  it("rejeita token gerado com outro secret", () => {
    const secret1 = generateSecret();
    const secret2 = generateSecret();
    const token = generateSync({ secret: secret1 });
    expect(verifyTotpToken(token, secret2)).toBe(false);
  });

  it("ignora espaços nas pontas", () => {
    const secret = generateSecret();
    const token = generateSync({ secret });
    expect(verifyTotpToken(`  ${token}  `, secret)).toBe(true);
  });
});

describe("checkBackupCode", () => {
  it("aceita código legado em texto plano e remove ele da lista", async () => {
    const codes = ["AAAAA-1111", "BBBBB-2222"];
    const result = await checkBackupCode("AAAAA-1111", JSON.stringify(codes));
    expect(result.valid).toBe(true);
    expect(result.remaining).toEqual(["BBBBB-2222"]);
  });

  it("aceita código hasheado com bcrypt e remove ele da lista", async () => {
    const { hashBackupCodes } = await import("./totp");
    const plain = ["AAAAA-1111", "BBBBB-2222"];
    const hashed = await hashBackupCodes(plain);
    const result = await checkBackupCode("AAAAA-1111", JSON.stringify(hashed));
    expect(result.valid).toBe(true);
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0]).toMatch(/^\$2[aby]\$/);
  });

  it("normaliza case (uppercase)", async () => {
    const codes = ["AAAAA-1111"];
    const result = await checkBackupCode("aaaaa-1111", JSON.stringify(codes));
    expect(result.valid).toBe(true);
  });

  it("rejeita código inexistente sem alterar a lista", async () => {
    const codes = ["AAAAA-1111"];
    const result = await checkBackupCode("XXXXX-9999", JSON.stringify(codes));
    expect(result.valid).toBe(false);
    expect(result.remaining).toEqual(codes);
  });

  it("rejeita quando storedJson é null", async () => {
    expect(await checkBackupCode("ABC", null)).toEqual({ valid: false, remaining: [] });
  });

  it("rejeita JSON inválido", async () => {
    expect(await checkBackupCode("ABC", "{not-json")).toEqual({ valid: false, remaining: [] });
  });
});

describe("createTotpSetup", () => {
  it("retorna secret, otpauthUrl e qrCodeSvg", async () => {
    const setup = await createTotpSetup("user@example.com", "Wedding Finance");
    expect(setup.secret.length).toBeGreaterThan(10);
    expect(setup.otpauthUrl).toContain("otpauth://totp/");
    expect(setup.otpauthUrl).toContain("Wedding%20Finance");
    expect(setup.qrCodeSvg).toContain("<svg");
  });
});

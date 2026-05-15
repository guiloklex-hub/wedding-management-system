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
  it("aceita código presente e remove ele da lista", () => {
    const codes = ["AAAAA-1111", "BBBBB-2222"];
    const result = checkBackupCode("AAAAA-1111", JSON.stringify(codes));
    expect(result.valid).toBe(true);
    expect(result.remaining).toEqual(["BBBBB-2222"]);
  });

  it("normaliza case (uppercase)", () => {
    const codes = ["AAAAA-1111"];
    const result = checkBackupCode("aaaaa-1111", JSON.stringify(codes));
    expect(result.valid).toBe(true);
  });

  it("rejeita código inexistente sem alterar a lista", () => {
    const codes = ["AAAAA-1111"];
    const result = checkBackupCode("XXXXX-9999", JSON.stringify(codes));
    expect(result.valid).toBe(false);
    expect(result.remaining).toEqual(codes);
  });

  it("rejeita quando storedJson é null", () => {
    expect(checkBackupCode("ABC", null)).toEqual({ valid: false, remaining: [] });
  });

  it("rejeita JSON inválido", () => {
    expect(checkBackupCode("ABC", "{not-json")).toEqual({ valid: false, remaining: [] });
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

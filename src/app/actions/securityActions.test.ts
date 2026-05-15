import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateSecret, generateSync } from "otplib";
import { prismaMock } from "@/test-utils/prisma";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

import {
  confirmTwoFactor,
  disableTwoFactor,
  startTwoFactorSetup,
} from "./securityActions";

beforeEach(() => {
  authMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

describe("startTwoFactorSetup", () => {
  it("retorna não autorizado sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const r = await startTwoFactorSetup();
    expect(r.success).toBe(false);
  });

  it("gera setup com secret + qrCode quando logado", async () => {
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    const r = await startTwoFactorSetup();
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data?.secret).toBeTruthy();
      expect(r.data?.qrCodeSvg).toContain("<svg");
      expect(r.data?.otpauthUrl).toContain("otpauth://totp/");
    }
  });
});

describe("confirmTwoFactor", () => {
  it("rejeita sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("secret", "ABCDEFGH");
    fd.set("token", "123456");
    const r = await confirmTwoFactor(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita token fora do formato 6 dígitos", async () => {
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    const fd = new FormData();
    fd.set("secret", "ABCDEFGH");
    fd.set("token", "abc123");
    const r = await confirmTwoFactor(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("rejeita quando TOTP é inválido para o secret", async () => {
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    const fd = new FormData();
    fd.set("secret", generateSecret());
    fd.set("token", "000000");
    const r = await confirmTwoFactor(undefined, fd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/TOTP/i);
  });

  it("ativa 2FA e devolve 8 backup codes com token válido", async () => {
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    const secret = generateSecret();
    const token = generateSync({ secret });

    prismaMock.user.update.mockResolvedValue({} as never);

    const fd = new FormData();
    fd.set("secret", secret);
    fd.set("token", token);
    const r = await confirmTwoFactor(undefined, fd);

    expect(r.success).toBe(true);
    if (r.success) expect(r.data?.backupCodes).toHaveLength(8);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "u@example.com" },
        data: expect.objectContaining({
          twoFactorEnabled: true,
          twoFactorSecret: secret,
        }),
      }),
    );
  });
});

describe("disableTwoFactor", () => {
  it("rejeita sem sessão", async () => {
    authMock.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("token", "123456");
    const r = await disableTwoFactor(undefined, fd);
    expect(r.success).toBe(false);
  });

  it("erro quando 2FA não está ativo", async () => {
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      twoFactorEnabled: false,
      twoFactorSecret: null,
    } as never);

    const fd = new FormData();
    fd.set("token", "123456");
    const r = await disableTwoFactor(undefined, fd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/2fa não está ativo/i);
  });

  it("desativa com TOTP válido", async () => {
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    const secret = generateSecret();
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: null,
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const fd = new FormData();
    fd.set("token", generateSync({ secret }));
    const r = await disableTwoFactor(undefined, fd);
    expect(r.success).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          twoFactorEnabled: false,
          twoFactorSecret: null,
        }),
      }),
    );
  });

  it("aceita backup code e remove ele da lista", async () => {
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      twoFactorEnabled: true,
      twoFactorSecret: generateSecret(),
      twoFactorBackupCodes: JSON.stringify(["AAAAA-11111", "BBBBB-22222"]),
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const fd = new FormData();
    fd.set("token", "AAAAA-11111");
    const r = await disableTwoFactor(undefined, fd);
    expect(r.success).toBe(true);
    const data = (prismaMock.user.update.mock.calls[0][0] as { data: { twoFactorBackupCodes: string } }).data;
    const remaining = JSON.parse(data.twoFactorBackupCodes);
    expect(remaining).toEqual(["BBBBB-22222"]);
  });

  it("rejeita código inválido", async () => {
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      twoFactorEnabled: true,
      twoFactorSecret: generateSecret(),
      twoFactorBackupCodes: JSON.stringify(["XXXXX-99999"]),
    } as never);

    const fd = new FormData();
    fd.set("token", "999999");
    const r = await disableTwoFactor(undefined, fd);
    expect(r.success).toBe(false);
  });
});

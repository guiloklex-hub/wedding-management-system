import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { generateSecret, generateSync } from "otplib";
import { prismaMock } from "@/test-utils/prisma";

type AuthorizeFn = (credentials: unknown) => Promise<unknown>;

const captured: { authorize: AuthorizeFn | null } = { authorize: null };

vi.mock("next-auth/providers/credentials", () => ({
  default: (config: { authorize: AuthorizeFn }) => {
    captured.authorize = config.authorize;
    return { id: "credentials", type: "credentials", ...config };
  },
}));

vi.mock("next-auth", () => ({
  default: () => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  captured.authorize = null;
  prismaMock.securitySettings.upsert.mockResolvedValue({
    id: "singleton",
    require2FARoles: "[]",
    passwordMinLength: 8,
    updatedAt: new Date(),
  } as never);
  prismaMock.user.update.mockResolvedValue({} as never);
  vi.resetModules();
  // Re-import after reset so module-side-effect re-registers the credentials provider
  await import("./auth");
});

async function callAuthorize(credentials: unknown) {
  if (!captured.authorize) throw new Error("authorize não foi capturado");
  return captured.authorize(credentials);
}

describe("auth.ts authorize callback", () => {
  it("retorna null para credentials inválidas (esquema Zod)", async () => {
    const r = await callAuthorize({ email: "not-email", password: "x" });
    expect(r).toBeNull();
  });

  it("retorna null quando usuário não existe (não distingue do password errado)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const r = await callAuthorize({ email: "a@example.com", password: "secret" });
    expect(r).toBeNull();
  });

  it("retorna null quando senha não bate", async () => {
    const hashed = await bcrypt.hash("verdadeira", 4);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@example.com",
      name: "Ana",
      role: "OWNER",
      password: hashed,
      isActive: true,
      archivedAt: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    } as never);

    const r = await callAuthorize({ email: "a@example.com", password: "errada" });
    expect(r).toBeNull();
  });

  it("retorna o user (sem password) no caminho feliz quando 2FA off", async () => {
    const hashed = await bcrypt.hash("secret123", 4);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@example.com",
      name: "Ana",
      role: "OWNER",
      password: hashed,
      isActive: true,
      archivedAt: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    } as never);

    const r = (await callAuthorize({ email: "a@example.com", password: "secret123" })) as {
      id: string;
      email: string;
      name: string;
      role: string;
      password?: string;
    };
    expect(r).toEqual({ id: "u1", email: "a@example.com", name: "Ana", role: "OWNER" });
    expect(r.password).toBeUndefined();
  });

  it("lança 2FA_REQUIRED quando 2FA ativo e token ausente", async () => {
    const hashed = await bcrypt.hash("secret123", 4);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@example.com",
      name: "Ana",
      role: "OWNER",
      password: hashed,
      isActive: true,
      archivedAt: null,
      twoFactorEnabled: true,
      twoFactorSecret: "ANYSECRET",
      twoFactorBackupCodes: null,
    } as never);

    await expect(
      callAuthorize({ email: "a@example.com", password: "secret123" }),
    ).rejects.toThrow("2FA_REQUIRED");
  });

  it("retorna user quando 2FA ativo e TOTP correto", async () => {
    const hashed = await bcrypt.hash("secret123", 4);
    const secret = generateSecret();
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@example.com",
      name: "Ana",
      role: "OWNER",
      password: hashed,
      isActive: true,
      archivedAt: null,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: null,
    } as never);

    const token = generateSync({ secret });
    const r = await callAuthorize({
      email: "a@example.com",
      password: "secret123",
      totp: token,
    });
    expect(r).not.toBeNull();
  });

  it("retorna null quando 2FA ativo e TOTP incorreto", async () => {
    const hashed = await bcrypt.hash("secret123", 4);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@example.com",
      name: "Ana",
      role: "OWNER",
      password: hashed,
      isActive: true,
      archivedAt: null,
      twoFactorEnabled: true,
      twoFactorSecret: generateSecret(),
      twoFactorBackupCodes: null,
    } as never);

    const r = await callAuthorize({
      email: "a@example.com",
      password: "secret123",
      totp: "000000",
    });
    expect(r).toBeNull();
  });

  it("aceita backup code e atualiza twoFactorBackupCodes com restante", async () => {
    const hashed = await bcrypt.hash("secret123", 4);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@example.com",
      name: "Ana",
      role: "OWNER",
      password: hashed,
      isActive: true,
      archivedAt: null,
      twoFactorEnabled: true,
      twoFactorSecret: generateSecret(),
      twoFactorBackupCodes: JSON.stringify(["AAAAA-11111", "BBBBB-22222"]),
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const r = await callAuthorize({
      email: "a@example.com",
      password: "secret123",
      totp: "AAAAA-11111",
    });
    expect(r).not.toBeNull();
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { twoFactorBackupCodes: JSON.stringify(["BBBBB-22222"]) },
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prismaMock } from "@/test-utils/prisma";

vi.mock("next-auth", () => {
  class FakeAuthError extends Error {
    type: string;
    cause: unknown;
    constructor(type = "CredentialsSignin", cause?: unknown) {
      super(type);
      this.type = type;
      this.cause = cause;
      this.name = "AuthError";
    }
  }
  return { AuthError: FakeAuthError };
});

const signInMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("@/auth", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
  signOut: () => signOutMock(),
  TWO_FACTOR_REQUIRED: "2FA_REQUIRED",
}));

import { AuthError } from "next-auth";
import { authenticate, logout, registerUser } from "./authActions";

beforeEach(() => {
  signInMock.mockReset();
  signOutMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("registerUser", () => {
  it("rejeita campos vazios", async () => {
    const fd = new FormData();
    fd.set("name", "");
    fd.set("email", "a@example.com");
    fd.set("password", "12345678");
    const r = await registerUser(undefined, fd);
    expect(r).toBe("Preencha todos os campos.");
  });

  it("rejeita senha curta", async () => {
    const fd = new FormData();
    fd.set("name", "Ana");
    fd.set("email", "a@example.com");
    fd.set("password", "123");
    const r = await registerUser(undefined, fd);
    expect(r).toMatch(/6 caracteres/);
  });

  it("rejeita email duplicado", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" } as never);
    const fd = new FormData();
    fd.set("name", "Ana");
    fd.set("email", "a@example.com");
    fd.set("password", "senha123");
    const r = await registerUser(undefined, fd);
    expect(r).toMatch(/em uso/);
  });

  it("primeiro usuário do sistema vira OWNER", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null); // sem owner
    prismaMock.invite.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "u1" } as never);

    const fd = new FormData();
    fd.set("name", "Ana");
    fd.set("email", "a@example.com");
    fd.set("password", "senha123");
    await expect(registerUser(undefined, fd)).rejects.toThrow(/NEXT_REDIRECT:\/login/);

    const data = (prismaMock.user.create.mock.calls[0][0] as { data: { role: string; password: string } }).data;
    expect(data.role).toBe("OWNER");
    expect(await bcrypt.compare("senha123", data.password)).toBe(true);
  });

  it("usuário subsequente sem convite vira VIEWER", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue({ id: "owner" } as never);
    prismaMock.invite.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "u2" } as never);

    const fd = new FormData();
    fd.set("name", "Bob");
    fd.set("email", "b@example.com");
    fd.set("password", "senha123");
    await expect(registerUser(undefined, fd)).rejects.toThrow(/NEXT_REDIRECT:\/login/);

    const data = (prismaMock.user.create.mock.calls[0][0] as { data: { role: string } }).data;
    expect(data.role).toBe("VIEWER");
  });

  it("usuário com convite válido assume role do convite", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue({ id: "owner" } as never);
    prismaMock.invite.findFirst.mockResolvedValue({ id: "i1", role: "PARTNER" } as never);
    prismaMock.user.create.mockResolvedValue({ id: "u3" } as never);
    prismaMock.invite.update.mockResolvedValue({} as never);

    const fd = new FormData();
    fd.set("name", "Carol");
    fd.set("email", "c@example.com");
    fd.set("password", "senha123");
    await expect(registerUser(undefined, fd)).rejects.toThrow(/NEXT_REDIRECT:\/login/);

    const data = (prismaMock.user.create.mock.calls[0][0] as { data: { role: string } }).data;
    expect(data.role).toBe("PARTNER");
    expect(prismaMock.invite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ acceptedBy: "u3" }),
      }),
    );
  });

  it("normaliza email para lowercase", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.invite.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "u1" } as never);

    const fd = new FormData();
    fd.set("name", "Ana");
    fd.set("email", "  A@EXAMPLE.COM  ");
    fd.set("password", "senha123");
    await expect(registerUser(undefined, fd)).rejects.toThrow(/NEXT_REDIRECT/);

    const data = (prismaMock.user.create.mock.calls[0][0] as { data: { email: string } }).data;
    expect(data.email).toBe("a@example.com");
  });
});

describe("authenticate", () => {
  it("retorna undefined no caminho feliz", async () => {
    signInMock.mockResolvedValue(undefined);
    const r = await authenticate(undefined, new FormData());
    expect(r).toBeUndefined();
    expect(signInMock).toHaveBeenCalledWith("credentials", expect.any(FormData));
  });

  it("retorna 2FA_REQUIRED quando AuthError encapsula esse motivo", async () => {
    signInMock.mockImplementation(() => {
      throw new (AuthError as unknown as new (t: string, c?: unknown) => Error)(
        "CredentialsSignin",
        { err: { message: "2FA_REQUIRED" } },
      );
    });
    const r = await authenticate(undefined, new FormData());
    expect(r).toBe("2FA_REQUIRED");
  });

  it("retorna 'Credenciais inválidas.' em CredentialsSignin", async () => {
    signInMock.mockImplementation(() => {
      throw new (AuthError as unknown as new (t: string) => Error)("CredentialsSignin");
    });
    const r = await authenticate(undefined, new FormData());
    expect(r).toMatch(/inválidas/i);
  });

  it("relança erros não-AuthError", async () => {
    signInMock.mockImplementation(() => {
      throw new Error("boom");
    });
    await expect(authenticate(undefined, new FormData())).rejects.toThrow("boom");
  });
});

describe("logout", () => {
  it("invoca signOut", async () => {
    signOutMock.mockResolvedValue(undefined);
    await logout();
    expect(signOutMock).toHaveBeenCalled();
  });
});

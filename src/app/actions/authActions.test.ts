import { describe, it, expect, beforeEach, vi } from "vitest";

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
  TWO_FACTOR_SETUP_REQUIRED: "2FA_SETUP_REQUIRED",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",
}));

import { AuthError } from "next-auth";
import { authenticate, logout } from "./authActions";

beforeEach(() => {
  signInMock.mockReset();
  signOutMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
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

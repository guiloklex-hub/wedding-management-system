import { describe, it, expect } from "vitest";
import { authConfig } from "./auth.config";

const callbacks = authConfig.callbacks!;

function callAuthorized(opts: {
  isLoggedIn: boolean;
  pathname: string;
  origin?: string;
}): boolean | Response {
  const origin = opts.origin ?? "https://example.test";
  const nextUrl = new URL(opts.pathname, origin) as URL & { basePath?: string };
  const auth = opts.isLoggedIn
    ? ({ user: { id: "u1", email: "a@example.com" } } as Parameters<
        NonNullable<typeof callbacks.authorized>
      >[0]["auth"])
    : null;
  const req = { nextUrl, url: nextUrl.toString(), headers: new Headers() } as unknown as Request;
  return callbacks.authorized!({ auth, request: req } as Parameters<
    NonNullable<typeof callbacks.authorized>
  >[0]) as boolean | Response;
}

describe("authConfig.callbacks.authorized", () => {
  it("permite /rsvp/* sem login (acesso público)", () => {
    expect(callAuthorized({ isLoggedIn: false, pathname: "/rsvp/abc" })).toBe(true);
  });

  it("permite /invite/* sem login", () => {
    expect(callAuthorized({ isLoggedIn: false, pathname: "/invite/xyz" })).toBe(true);
  });

  it("nega /dashboard quando deslogado", () => {
    expect(callAuthorized({ isLoggedIn: false, pathname: "/dashboard" })).toBe(false);
  });

  it("nega /dashboard/* quando deslogado", () => {
    expect(callAuthorized({ isLoggedIn: false, pathname: "/dashboard/guests" })).toBe(false);
  });

  it("permite /dashboard quando logado", () => {
    expect(callAuthorized({ isLoggedIn: true, pathname: "/dashboard" })).toBe(true);
  });

  it("redireciona logado de /login para /dashboard", () => {
    const r = callAuthorized({ isLoggedIn: true, pathname: "/login" });
    expect(r).toBeInstanceOf(Response);
    if (r instanceof Response) {
      expect(r.status).toBeGreaterThanOrEqual(300);
      expect(r.headers.get("location")).toContain("/dashboard");
    }
  });

  it("redireciona logado de /register para /dashboard", () => {
    const r = callAuthorized({ isLoggedIn: true, pathname: "/register" });
    expect(r).toBeInstanceOf(Response);
    if (r instanceof Response) {
      expect(r.headers.get("location")).toContain("/dashboard");
    }
  });

  it("redireciona logado de / (raiz) para /dashboard", () => {
    const r = callAuthorized({ isLoggedIn: true, pathname: "/" });
    expect(r).toBeInstanceOf(Response);
  });

  it("rotas públicas (ex.: /api/auth/...) retornam true para deslogado", () => {
    expect(callAuthorized({ isLoggedIn: false, pathname: "/api/auth/session" })).toBe(true);
  });
});

type JwtArg = Parameters<NonNullable<typeof callbacks.jwt>>[0];
type SessionArg = Parameters<NonNullable<typeof callbacks.session>>[0];

describe("authConfig.callbacks.jwt", () => {
  it("copia role do user para o token", () => {
    const token = callbacks.jwt!({
      token: {},
      user: { role: "OWNER" },
    } as unknown as JwtArg) as { role?: string };
    expect(token.role).toBe("OWNER");
  });

  it("preserva token quando não há user (refresh)", () => {
    const token = callbacks.jwt!({
      token: { role: "PARTNER" },
    } as unknown as JwtArg) as { role?: string };
    expect(token.role).toBe("PARTNER");
  });
});

describe("authConfig.callbacks.session", () => {
  it("copia role do token para session.user", async () => {
    const session = await callbacks.session!({
      session: { user: { id: "u1", email: "a@example.com" } },
      token: { role: "OWNER" },
    } as unknown as SessionArg);
    expect((session.user as { role?: string }).role).toBe("OWNER");
  });
});

describe("authConfig.pages", () => {
  it("aponta signIn para /login", () => {
    expect(authConfig.pages?.signIn).toBe("/login");
  });
});

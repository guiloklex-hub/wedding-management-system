"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { authenticate } from "@/app/actions/authActions";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";

const TWO_FACTOR_REQUIRED = "2FA_REQUIRED";
const TWO_FACTOR_SETUP_REQUIRED = "2FA_SETUP_REQUIRED";
const ACCOUNT_DISABLED = "ACCOUNT_DISABLED";

const FRIENDLY_ERROR: Record<string, string> = {
  [TWO_FACTOR_SETUP_REQUIRED]:
    "Sua função exige 2FA. Peça para um administrador resetar sua senha e configure 2FA na primeira entrada — ou peça para ele afrouxar a política.",
  [ACCOUNT_DISABLED]: "Conta desativada. Procure um administrador.",
};

function resolveRedirectTo(): string {
  if (typeof window === "undefined") return "/dashboard";
  try {
    const raw = new URLSearchParams(window.location.search).get("callbackUrl");
    if (!raw) return "/dashboard";
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/dashboard";
    const path = `${url.pathname}${url.search}`;
    if (!path.startsWith("/") || path === "/login" || path.startsWith("/login?") || path.startsWith("/login/")) {
      return "/dashboard";
    }
    return path;
  } catch {
    return "/dashboard";
  }
}

export default function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const redirectRef = useRef<HTMLInputElement>(null);
  const needs2fa = errorMessage === TWO_FACTOR_REQUIRED;
  const friendly =
    errorMessage && errorMessage !== TWO_FACTOR_REQUIRED
      ? FRIENDLY_ERROR[errorMessage] ?? errorMessage
      : null;

  useEffect(() => {
    if (redirectRef.current) {
      redirectRef.current.value = resolveRedirectTo();
    }
  }, []);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl backdrop-blur-sm"
    >
      <input ref={redirectRef} type="hidden" name="redirectTo" defaultValue="/dashboard" />
      <div className="space-y-4">
        <div suppressHydrationWarning>
          <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="email">
            Email
          </label>
          <input
            className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            id="email"
            type="email"
            name="email"
            placeholder="seu@email.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            suppressHydrationWarning
          />
        </div>
        <div suppressHydrationWarning>
          <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="password">
            Senha
          </label>
          <input
            className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            id="password"
            type="password"
            name="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            minLength={1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            suppressHydrationWarning
          />
        </div>
        {needs2fa ? (
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-300" htmlFor="totp">
              <ShieldCheck className="h-4 w-4 text-rose-400" /> Código 2FA
            </label>
            <input
              className="block w-full rounded-xl border border-rose-500/30 bg-zinc-950 px-4 py-3 text-center text-lg tracking-widest text-zinc-200 outline-none focus:border-rose-500/50"
              id="totp"
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              required
              autoFocus
              maxLength={11}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Digite o código de 6 dígitos do seu app autenticador (ou um código de backup).
            </p>
          </div>
        ) : null}
      </div>

      {friendly ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {friendly}
        </div>
      ) : null}

      <button
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-rose-500 disabled:opacity-50"
        aria-disabled={isPending}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : needs2fa ? (
          "Verificar e entrar"
        ) : (
          "Entrar"
        )}
        {!isPending ? <ArrowRight className="h-4 w-4" /> : null}
      </button>

      <div className="text-center">
        <Link
          href="/forgot-password"
          className="text-sm text-zinc-400 hover:text-rose-400"
        >
          Esqueci minha senha
        </Link>
      </div>
    </form>
  );
}

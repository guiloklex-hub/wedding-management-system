"use client";

import { useActionState } from "react";
import { authenticate } from "@/app/actions/authActions";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";

const TWO_FACTOR_REQUIRED = "2FA_REQUIRED";

export default function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);
  const needs2fa = errorMessage === TWO_FACTOR_REQUIRED;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl backdrop-blur-sm"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="email">
            Email
          </label>
          <input
            className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            id="email"
            type="email"
            name="email"
            placeholder="seu@email.com"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="password">
            Senha
          </label>
          <input
            className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            id="password"
            type="password"
            name="password"
            placeholder="••••••••"
            required
            minLength={1}
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

      {errorMessage && !needs2fa ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {errorMessage}
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
        <p className="text-sm text-zinc-400">
          Não tem uma conta?{" "}
          <Link href="/register" className="font-medium text-rose-500 hover:text-rose-400">
            Crie aqui
          </Link>
        </p>
      </div>
    </form>
  );
}

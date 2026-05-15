"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/passwordResetActions";

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    undefined,
  );

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl backdrop-blur-sm">
        <p className="text-sm text-zinc-300">
          Se o email existir na nossa base, enviaremos um link para redefinir
          sua senha. Verifique sua caixa de entrada e o WhatsApp do número
          cadastrado. O link expira em 60 minutos.
        </p>
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-rose-500 hover:text-rose-400"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl backdrop-blur-sm"
    >
      <div>
        <label
          className="mb-2 block text-sm font-medium text-zinc-300"
          htmlFor="email"
        >
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

      {state && !state.success ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {state.error}
        </div>
      ) : null}

      <button
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-rose-500 disabled:opacity-50"
        aria-disabled={isPending}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Enviar link de redefinição
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-zinc-400 hover:text-rose-400"
        >
          Voltar para o login
        </Link>
      </div>
    </form>
  );
}

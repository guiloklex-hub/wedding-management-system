'use client';

import { useActionState } from 'react';
import { authenticate } from '@/app/actions/authActions';
import { ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl backdrop-blur-sm">
      <div className="space-y-4">
        <div>
          <label
            className="mb-2 block text-sm font-medium text-zinc-300"
            htmlFor="email"
          >
            Email
          </label>
          <div className="relative">
            <input
              className="peer block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 transition-all"
              id="email"
              type="email"
              name="email"
              placeholder="Digite seu email"
              required
            />
          </div>
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-zinc-300"
            htmlFor="password"
          >
            Senha
          </label>
          <div className="relative">
            <input
              className="peer block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 transition-all"
              id="password"
              type="password"
              name="password"
              placeholder="Digite sua senha"
              required
              minLength={1}
            />
          </div>
        </div>
      </div>
      
      {errorMessage && (
        <div className="flex items-center space-x-2 text-sm text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          <p>{errorMessage}</p>
        </div>
      )}

      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-disabled={isPending}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Entrar'}
        {!isPending && <ArrowRight className="h-4 w-4" />}
      </button>
      
      <div className="text-center mt-4">
        <p className="text-sm text-zinc-400">
          Não tem uma conta?{' '}
          <Link href="/register" className="text-rose-500 hover:text-rose-400 transition-colors font-medium">
            Crie aqui
          </Link>
        </p>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { changeOwnPassword } from "@/app/actions/userActions";
import { useToast } from "@/components/toast";

export default function ChangePasswordForm({
  required,
  minPasswordLength,
  email,
}: {
  required: boolean;
  minPasswordLength: number;
  email: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const { update } = useSession();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handle(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");
    if (newPassword !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await changeOwnPassword(undefined, formData);
        if (r.success) {
          await update({ mustChangePassword: false });
          toast.success("Senha atualizada");
          router.replace("/dashboard");
          router.refresh();
        } else {
          setError(r.error);
        }
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <form
      action={handle}
      className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
    >
      {required ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Sua conta ({email}) está com uma senha provisória definida por um administrador. Defina uma
            senha definitiva agora para continuar.
          </p>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-400">Senha atual</label>
        <input
          name="currentPassword"
          type="password"
          required
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-400">
          Nova senha (mínimo {minPasswordLength} caracteres)
        </label>
        <input
          name="newPassword"
          type="password"
          required
          minLength={minPasswordLength}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-400">Confirme a nova senha</label>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={minPasswordLength}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        {!required ? (
          <Link
            href="/dashboard/settings"
            className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </Link>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {required ? "Definir senha e continuar" : "Atualizar senha"}
        </button>
      </div>
    </form>
  );
}

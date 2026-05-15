"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { acceptInvite } from "@/app/actions/securityActions";

export default function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  function handle() {
    setBusy(true);
    setError(null);
    startTransition(async () => {
      try {
        const r = await acceptInvite(token);
        if (r.success) {
          setDone(true);
          setTimeout(() => router.push("/dashboard"), 1200);
        } else {
          setError(r.error);
        }
      } finally {
        setBusy(false);
      }
    });
  }

  if (done) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200">
        <CheckCircle2 className="h-5 w-5" />
        <span>Convite aceito! Redirecionando…</span>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Aceitar convite
      </button>
      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>
      ) : null}
    </div>
  );
}

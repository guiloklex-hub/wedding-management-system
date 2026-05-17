"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function AlreadyDone() {
  const { update } = useSession();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        await update({ onboardingCompleted: true });
      } catch {
        // Mesmo se o update falhar, o hard reload abaixo reemite o JWT pelo cookie.
      }
      window.location.replace("/dashboard");
    })();
  }, [update]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center shadow-xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="h-6 w-6 text-emerald-300" />
      </div>
      <h1 className="text-lg font-semibold text-white">Onboarding já concluído</h1>
      <p className="text-sm text-zinc-400">
        Sincronizando sua sessão e levando você ao painel…
      </p>
      <Loader2 className="mt-2 h-5 w-5 animate-spin text-rose-400" />
    </div>
  );
}

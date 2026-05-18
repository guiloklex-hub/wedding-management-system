"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2 } from "lucide-react";
import { consumePasswordReset } from "@/app/actions/passwordResetActions";

export default function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.reset");
  const [state, formAction, isPending] = useActionState(
    consumePasswordReset,
    undefined,
  );

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl backdrop-blur-sm">
        <p className="text-sm text-zinc-300">{t("success")}</p>
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-medium text-white hover:bg-rose-500"
          >
            {t("goToLogin")}
            <ArrowRight className="h-4 w-4" />
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
      <input type="hidden" name="token" value={token} />

      <div>
        <label
          className="mb-2 block text-sm font-medium text-zinc-300"
          htmlFor="newPassword"
        >
          {t("newPassword")}
        </label>
        <input
          className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
          id="newPassword"
          type="password"
          name="newPassword"
          placeholder="••••••••"
          required
          minLength={6}
          maxLength={128}
        />
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium text-zinc-300"
          htmlFor="confirmPassword"
        >
          {t("confirmPassword")}
        </label>
        <input
          className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
          id="confirmPassword"
          type="password"
          name="confirmPassword"
          placeholder="••••••••"
          required
          minLength={6}
          maxLength={128}
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
            {t("submit")}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}

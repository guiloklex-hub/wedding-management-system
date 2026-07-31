"use client";

import { useActionState, useTransition } from "react";
import { verifyRsvpPinAction } from "@/lib/rsvp-pin-auth";
import type { ActionResult } from "@/types";

type PinGateFormProps = {
  token: string;
  type: "individual" | "group";
  labels: {
    title: string;
    description: string;
    placeholder: string;
    submit: string;
  };
};

export function PinGateForm({ token, type, labels }: PinGateFormProps) {
  const [isPending, startTransition] = useTransition();

  const [state, formAction] = useActionState(
    async (prevState: ActionResult | undefined, formData: FormData) => {
      const res = await verifyRsvpPinAction(prevState, formData);
      if (res.success) {
        window.location.reload();
      }
      return res;
    },
    undefined,
  );

  return (
    <form
      action={(formData) => {
        startTransition(() => {
          formAction(formData);
        });
      }}
      className="mt-6 space-y-4"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="type" value={type} />

      <div>
        <label htmlFor="pin-input" className="block text-xs font-medium uppercase tracking-wider text-rose-300">
          {labels.title}
        </label>
        <p className="mt-1 text-xs text-zinc-400">{labels.description}</p>
        <input
          id="pin-input"
          type="password"
          name="pin"
          required
          maxLength={32}
          placeholder={labels.placeholder}
          className="mt-2 w-full rounded-xl border border-rose-500/30 bg-zinc-900/90 px-4 py-3 text-center text-lg font-mono tracking-widest text-white placeholder-zinc-500 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
          autoFocus
        />
      </div>

      {state && !state.success && (
        <p className="text-center text-xs font-semibold text-rose-400" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:from-rose-500 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-50 min-h-[44px]"
      >
        {isPending ? "..." : labels.submit}
      </button>
    </form>
  );
}

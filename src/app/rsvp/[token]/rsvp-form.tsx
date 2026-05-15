"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { publicRsvpRespond } from "@/app/actions/guestActions";

type Guest = {
  id: string;
  name: string;
  rsvpToken: string;
  rsvpStatus: string;
  plusOnesAllowed: number;
  plusOnesConfirmed: number;
  dietary: string | null;
  notes: string | null;
};

export default function RsvpForm({ guest }: { guest: Guest }) {
  const [choice, setChoice] = useState<"CONFIRMED" | "DECLINED" | "MAYBE" | null>(
    guest.rsvpStatus === "CONFIRMED" || guest.rsvpStatus === "DECLINED" || guest.rsvpStatus === "MAYBE"
      ? guest.rsvpStatus
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setBusy(true);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await publicRsvpRespond(undefined, formData);
        if (r.success && r.data) {
          setResult({
            tone: "ok",
            text:
              r.data.status === "CONFIRMED"
                ? "Confirmação recebida! 🎉 Te esperamos!"
                : r.data.status === "DECLINED"
                  ? "Vamos sentir sua falta. Obrigado por avisar."
                  : "Resposta registrada como talvez. Avisa logo que decidir!",
          });
        } else if (!r.success) {
          setResult({ tone: "bad", text: r.error });
        }
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <form action={handleSubmit} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={guest.rsvpToken} />

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-zinc-200">Você vem ao nosso casamento?</legend>
        <Choice
          name="status"
          value="CONFIRMED"
          checked={choice === "CONFIRMED"}
          onChange={() => setChoice("CONFIRMED")}
          label="Sim, vou estar lá!"
          color="emerald"
        />
        <Choice
          name="status"
          value="MAYBE"
          checked={choice === "MAYBE"}
          onChange={() => setChoice("MAYBE")}
          label="Talvez (vou avisar depois)"
          color="amber"
        />
        <Choice
          name="status"
          value="DECLINED"
          checked={choice === "DECLINED"}
          onChange={() => setChoice("DECLINED")}
          label="Infelizmente não consigo"
          color="rose"
        />
      </fieldset>

      {choice === "CONFIRMED" && guest.plusOnesAllowed > 0 ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-200">
            Vai levar acompanhante(s)?
          </label>
          <input
            type="number"
            name="plusOnesConfirmed"
            min={0}
            max={guest.plusOnesAllowed}
            defaultValue={guest.plusOnesConfirmed}
            className="w-full rounded-xl border border-rose-500/20 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-400"
          />
          <p className="mt-1 text-[11px] text-zinc-500">Permitidos até {guest.plusOnesAllowed}.</p>
        </div>
      ) : (
        <input type="hidden" name="plusOnesConfirmed" value="0" />
      )}

      {choice === "CONFIRMED" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-200">
            Restrições alimentares
          </label>
          <input
            type="text"
            name="dietary"
            maxLength={200}
            defaultValue={guest.dietary ?? ""}
            placeholder="Ex: vegetariano, sem glúten..."
            className="w-full rounded-xl border border-rose-500/20 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-400"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-200">Recado para os noivos</label>
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          defaultValue={guest.notes ?? ""}
          className="w-full rounded-xl border border-rose-500/20 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-400"
        />
      </div>

      <button
        type="submit"
        disabled={!choice || busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar resposta"}
      </button>

      {result ? (
        <div
          className={`mt-2 flex items-center gap-2 rounded-xl border p-3 text-sm ${
            result.tone === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {result.tone === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span>{result.text}</span>
        </div>
      ) : null}
    </form>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  label,
  color,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  color: "emerald" | "amber" | "rose";
}) {
  const tone = checked
    ? color === "emerald"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
      : color === "amber"
        ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
        : "border-rose-500/40 bg-rose-500/15 text-rose-100"
    : "border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800/80";
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="accent-rose-500"
      />
      <span>{label}</span>
    </label>
  );
}

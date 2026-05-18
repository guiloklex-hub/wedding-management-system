"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { publicRsvpRespondForGroup } from "@/app/actions/guestGroupActions";
import type { Locale } from "@/i18n/config";

type GroupMember = {
  id: string;
  name: string;
  rsvpStatus: string;
  plusOnesAllowed: number;
  plusOnesConfirmed: number;
  dietary: string | null;
  isChild: boolean;
};

type GroupData = {
  id: string;
  name: string;
  rsvpToken: string;
  guests: GroupMember[];
};

type Status = "CONFIRMED" | "DECLINED" | "MAYBE";

type MemberAnswer = {
  status: Status | null;
  plusOnesConfirmed: number;
  dietary: string;
};

function defaultAnswer(member: GroupMember): MemberAnswer {
  const isStatus =
    member.rsvpStatus === "CONFIRMED" ||
    member.rsvpStatus === "DECLINED" ||
    member.rsvpStatus === "MAYBE";
  return {
    status: isStatus ? (member.rsvpStatus as Status) : null,
    plusOnesConfirmed: member.plusOnesConfirmed ?? 0,
    dietary: member.dietary ?? "",
  };
}

export default function GroupRsvpForm({
  group,
  locale,
  messages,
}: {
  group: GroupData;
  locale: Locale;
  messages: Record<string, unknown>;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <InnerForm group={group} />
    </NextIntlClientProvider>
  );
}

function InnerForm({ group }: { group: GroupData }) {
  const t = useTranslations("rsvp.group");
  const [answers, setAnswers] = useState<Record<string, MemberAnswer>>(() => {
    const map: Record<string, MemberAnswer> = {};
    for (const g of group.guests) map[g.id] = defaultAnswer(g);
    return map;
  });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  function updateAnswer(guestId: string, patch: Partial<MemberAnswer>) {
    setAnswers((cur) => ({ ...cur, [guestId]: { ...cur[guestId], ...patch } }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    const responses = Object.entries(answers).map(([guestId, a]) => ({
      guestId,
      status: (a.status ?? "MAYBE") as Status,
      plusOnesConfirmed: a.plusOnesConfirmed,
      dietary: a.dietary.trim() || null,
    }));

    const unanswered = Object.values(answers).filter((a) => a.status === null).length;
    if (unanswered > 0) {
      setResult({
        tone: "bad",
        text: t("errors.missingAnswers", { count: group.guests.length }),
      });
      return;
    }

    setBusy(true);
    startTransition(async () => {
      try {
        const r = await publicRsvpRespondForGroup({
          token: group.rsvpToken,
          responses,
          notes: notes.trim() || null,
        });
        if (r.success && r.data) {
          setResult({ tone: "ok", text: t("success", { count: r.data.count }) });
        } else if (!r.success) {
          setResult({ tone: "bad", text: r.error });
        }
      } finally {
        setBusy(false);
      }
    });
  }

  if (result?.tone === "ok") {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
        <p className="text-sm text-emerald-200">{result.text}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <ul className="space-y-3">
        {group.guests.map((m) => {
          const a = answers[m.id];
          return (
            <li key={m.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <header className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-100">
                  {m.name}
                  {m.isChild ? (
                    <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                      {t("child")}
                    </span>
                  ) : null}
                </span>
              </header>
              <div className="grid grid-cols-3 gap-1.5">
                <StatusBtn
                  label={t("choices.yes")}
                  active={a.status === "CONFIRMED"}
                  tone="emerald"
                  onClick={() => updateAnswer(m.id, { status: "CONFIRMED" })}
                />
                <StatusBtn
                  label={t("choices.maybe")}
                  active={a.status === "MAYBE"}
                  tone="amber"
                  onClick={() => updateAnswer(m.id, { status: "MAYBE", plusOnesConfirmed: 0 })}
                />
                <StatusBtn
                  label={t("choices.no")}
                  active={a.status === "DECLINED"}
                  tone="rose"
                  onClick={() => updateAnswer(m.id, { status: "DECLINED", plusOnesConfirmed: 0 })}
                />
              </div>
              {a.status === "CONFIRMED" && m.plusOnesAllowed > 0 ? (
                <div className="mt-3">
                  <label className="text-xs font-medium text-zinc-400">
                    {t("plusOnesLabel", { max: m.plusOnesAllowed })}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={m.plusOnesAllowed}
                    value={a.plusOnesConfirmed}
                    onChange={(e) =>
                      updateAnswer(m.id, {
                        plusOnesConfirmed: Math.min(
                          m.plusOnesAllowed,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-400"
                  />
                </div>
              ) : null}
              {a.status === "CONFIRMED" ? (
                <div className="mt-3">
                  <label className="text-xs font-medium text-zinc-400">{t("dietary")}</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={a.dietary}
                    onChange={(e) => updateAnswer(m.id, { dietary: e.target.value })}
                    placeholder={t("dietaryPlaceholder")}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-400"
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div>
        <label className="text-xs font-medium text-zinc-400">{t("notes")}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-400"
        />
      </div>

      {result?.tone === "bad" ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
          <XCircle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{result.text}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t("submit")}
      </button>
    </form>
  );
}

function StatusBtn({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: "emerald" | "amber" | "rose";
  onClick: () => void;
}) {
  const palette = {
    emerald: {
      activeBg: "bg-emerald-500/20 border-emerald-500 text-emerald-200",
      idleBg: "border-zinc-700 text-zinc-300 hover:border-emerald-500/50",
    },
    amber: {
      activeBg: "bg-amber-500/20 border-amber-500 text-amber-200",
      idleBg: "border-zinc-700 text-zinc-300 hover:border-amber-500/50",
    },
    rose: {
      activeBg: "bg-rose-500/20 border-rose-500 text-rose-200",
      idleBg: "border-zinc-700 text-zinc-300 hover:border-rose-500/50",
    },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
        active ? palette.activeBg : palette.idleBg
      }`}
    >
      {label}
    </button>
  );
}

import Link from "next/link";
import { UserCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function RsvpMini({
  rsvp,
  guestsTotal,
}: {
  rsvp: { invited: number; confirmed: number; declined: number; maybe: number; plusOnesConfirmed: number };
  guestsTotal: number;
}) {
  const t = await getTranslations("dashboard.home");
  const total = rsvp.invited + rsvp.confirmed + rsvp.declined + rsvp.maybe;
  if (total === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">{t("rsvp.title")}</h2>
          <UserCheck className="h-4 w-4 text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-500">{t("rsvp.empty")}</p>
      </div>
    );
  }
  const confirmedPct = total > 0 ? Math.round((rsvp.confirmed / total) * 100) : 0;
  return (
    <Link
      href="/dashboard/reports/guests"
      className="block rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm transition-colors hover:bg-zinc-800/50"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">{t("rsvp.title")}</h2>
        <UserCheck className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-bold text-zinc-100">{confirmedPct}%</p>
          <p className="mt-1 break-words text-xs text-zinc-500">
            {t("rsvp.respondedConfirming", { confirmed: rsvp.confirmed, total })}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-1 gap-1 text-right text-xs">
          <span className="text-emerald-400">{t("rsvp.confirmed", { count: rsvp.confirmed })}</span>
          <span className="text-amber-400">{t("rsvp.maybe", { count: rsvp.maybe })}</span>
          <span className="text-rose-400">{t("rsvp.declined", { count: rsvp.declined })}</span>
          <span className="text-zinc-500">{t("rsvp.pending", { count: rsvp.invited })}</span>
        </div>
      </div>
      {rsvp.plusOnesConfirmed > 0 ? (
        <p className="mt-3 text-xs text-zinc-500">{t("rsvp.plusOnes", { count: rsvp.plusOnesConfirmed })}</p>
      ) : null}
      {guestsTotal !== total ? (
        <p className="mt-1 text-[10px] text-zinc-600">{t("rsvp.totalGuests", { count: guestsTotal })}</p>
      ) : null}
    </Link>
  );
}

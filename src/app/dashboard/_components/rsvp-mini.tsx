import Link from "next/link";
import { UserCheck } from "lucide-react";

export function RsvpMini({
  rsvp,
  guestsTotal,
}: {
  rsvp: { invited: number; confirmed: number; declined: number; maybe: number; plusOnesConfirmed: number };
  guestsTotal: number;
}) {
  const total = rsvp.invited + rsvp.confirmed + rsvp.declined + rsvp.maybe;
  if (total === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Confirmações (RSVP)</h2>
          <UserCheck className="h-4 w-4 text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-500">Nenhum convidado cadastrado ainda.</p>
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
        <h2 className="text-sm font-semibold text-zinc-200">Confirmações (RSVP)</h2>
        <UserCheck className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-zinc-100">{confirmedPct}%</p>
          <p className="mt-1 text-xs text-zinc-500">
            {rsvp.confirmed} de {total} responderam confirmando
          </p>
        </div>
        <div className="grid grid-cols-1 gap-1 text-right text-xs">
          <span className="text-emerald-400">{rsvp.confirmed} confirmados</span>
          <span className="text-amber-400">{rsvp.maybe} talvez</span>
          <span className="text-rose-400">{rsvp.declined} recusas</span>
          <span className="text-zinc-500">{rsvp.invited} pendentes</span>
        </div>
      </div>
      {rsvp.plusOnesConfirmed > 0 ? (
        <p className="mt-3 text-xs text-zinc-500">+{rsvp.plusOnesConfirmed} acompanhantes confirmados</p>
      ) : null}
      {guestsTotal !== total ? (
        <p className="mt-1 text-[10px] text-zinc-600">{guestsTotal} convidados no total</p>
      ) : null}
    </Link>
  );
}

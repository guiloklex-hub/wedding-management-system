"use client";

import type { ClassifiedRow } from "@/app/actions/guestActions";

const STATUS_LABEL: Record<ClassifiedRow["classification"], string> = {
  new: "Novo",
  duplicate_same: "Já existe (mesmo grupo)",
  duplicate_diff: "Já existe, dados divergem",
};

const STATUS_CHIP: Record<ClassifiedRow["classification"], string> = {
  new: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  duplicate_same: "bg-zinc-800 text-zinc-400 border-zinc-700",
  duplicate_diff: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

const RSVP_LABEL: Record<string, string> = {
  NOT_INVITED: "Não convidado",
  INVITED: "Convidado",
  CONFIRMED: "Confirmado",
  DECLINED: "Recusou",
  MAYBE: "Talvez",
};

export function PreviewTable({
  rows,
  filter,
}: {
  rows: ClassifiedRow[];
  filter: "all" | ClassifiedRow["classification"];
}) {
  const visible = filter === "all" ? rows : rows.filter((r) => r.classification === filter);

  if (visible.length === 0) {
    return (
      <p className="rounded-xl bg-zinc-950 px-3 py-6 text-center text-sm text-zinc-500">
        Nenhuma linha para este filtro.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-left text-xs text-zinc-400">
        <thead className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Nome</th>
            <th className="px-3 py-2 font-medium">Grupo</th>
            <th className="px-3 py-2 font-medium">RSVP</th>
            <th className="px-3 py-2 font-medium">Telefone</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Tags</th>
            <th className="px-3 py-2 font-medium">Criança</th>
            <th className="px-3 py-2 font-medium">PIN</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {visible.map((row, idx) => (
            <tr key={`${row.name}-${idx}`} className="hover:bg-zinc-900/60">
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${STATUS_CHIP[row.classification]}`}
                >
                  {STATUS_LABEL[row.classification]}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-100">{row.name}</td>
              <td className="px-3 py-2">{row.groupName ?? "—"}</td>
              <td className="px-3 py-2">
                {RSVP_LABEL[row.rsvpStatus] ?? row.rsvpStatus}
                {row.rsvpStatusRaw && row.rsvpStatus === "INVITED" && row.rsvpStatusRaw !== "Sem resposta" ? (
                  <span
                    className="ml-1 text-[10px] text-amber-400"
                    title={`Status original "${row.rsvpStatusRaw}" não reconhecido; tratado como Convidado.`}
                  >
                    *
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2">{row.phone ?? "—"}</td>
              <td className="px-3 py-2">{row.email ?? "—"}</td>
              <td className="px-3 py-2">
                {row.tags.length > 0 ? row.tags.join(", ") : "—"}
              </td>
              <td className="px-3 py-2">
                {row.isChild ? `Sim${row.age != null ? ` (${row.age})` : ""}` : "—"}
              </td>
              <td className="px-3 py-2">{row.pin ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

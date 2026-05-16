import { Users2 } from "lucide-react";
import Link from "next/link";

type Funnel = { NEGOTIATION: number; CONTRACTED: number; FINALIZED: number };

export function FunnelCard({ funnel }: { funnel: Funnel }) {
  const total = funnel.NEGOTIATION + funnel.CONTRACTED + funnel.FINALIZED;
  if (total === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Funil de Fornecedores</h2>
          <Users2 className="h-4 w-4 text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-500">Nenhum fornecedor cadastrado.</p>
      </div>
    );
  }
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  const segments = [
    { key: "NEGOTIATION", label: "Negociando", value: funnel.NEGOTIATION, color: "bg-amber-500" },
    { key: "CONTRACTED", label: "Contratados", value: funnel.CONTRACTED, color: "bg-violet-500" },
    { key: "FINALIZED", label: "Finalizados", value: funnel.FINALIZED, color: "bg-emerald-500" },
  ];
  return (
    <Link
      href="/dashboard/reports/vendor-funnel"
      className="block rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm transition-colors hover:bg-zinc-800/50"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Funil de Fornecedores</h2>
        <Users2 className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.key}
              className={s.color}
              style={{ width: `${pct(s.value)}%` }}
              title={`${s.label}: ${s.value}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {segments.map((s) => (
          <div key={s.key} className="flex flex-col items-start">
            <div className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${s.color}`} />
              <span className="text-zinc-400">{s.label}</span>
            </div>
            <span className="mt-1 font-semibold text-zinc-100">{s.value}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

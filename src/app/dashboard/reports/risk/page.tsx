import Link from "next/link";
import { ChevronLeft, AlertCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { loadDashboardData } from "@/lib/reports/dashboard-data";
import { canViewSensitiveFinance } from "@/lib/permissions";
import type { Severity, RiskAlert } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

const SEVERITY_STYLES: Record<
  Severity,
  { border: string; bg: string; text: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  red: {
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
    text: "text-rose-300",
    Icon: AlertCircle,
  },
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    Icon: AlertTriangle,
  },
  green: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    Icon: ShieldCheck,
  },
};

export default async function RiskRadarPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canSeeFinance = canViewSensitiveFinance(role);

  const data = await loadDashboardData(role);
  const visible = data.risks.filter((r) => (r.finance ? canSeeFinance : true));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <ChevronLeft className="h-3 w-3" />
          Voltar para relatórios
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Risk Radar</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Sinais consolidados que merecem atenção: liquidez, contratos no prazo, tarefas
          atrasadas e fornecedores que estouraram o orçamento estimado.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Críticos" count={visible.filter((r) => r.severity === "red").length} color="text-rose-400" />
        <Tile label="Atenção" count={visible.filter((r) => r.severity === "amber").length} color="text-amber-400" />
        <Tile label="Ok" count={visible.filter((r) => r.severity === "green").length} color="text-emerald-400" />
      </div>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-200">
            <ShieldCheck className="h-6 w-6" />
            <p className="mt-2 text-sm">Sem sinais vermelhos no momento. Bom trabalho.</p>
          </div>
        ) : (
          visible.map((alert: RiskAlert) => {
            const style = SEVERITY_STYLES[alert.severity];
            const Icon = style.Icon;
            return (
              <Link
                key={alert.id}
                href={alert.href}
                className={`flex items-start gap-3 rounded-2xl border ${style.border} ${style.bg} p-4 transition-colors hover:bg-opacity-20`}
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.text}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${style.text}`}>{alert.title}</p>
                  <p className="mt-1 text-xs text-zinc-300">{alert.body}</p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function Tile({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{count}</p>
    </div>
  );
}

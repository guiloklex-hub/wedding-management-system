import Link from "next/link";
import { AlertCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import type { RiskAlert } from "@/lib/reports/types";

const SEVERITY_STYLES = {
  red: {
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
    text: "text-rose-300",
    icon: AlertCircle,
  },
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    icon: AlertTriangle,
  },
  green: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    icon: ShieldCheck,
  },
} as const;

export function RiskAlertStrip({
  risks,
  canSeeFinance,
}: {
  risks: RiskAlert[];
  canSeeFinance: boolean;
}) {
  const visible = risks.filter((r) => (r.finance ? canSeeFinance : true));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-zinc-200">Sinais de atenção</h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
          {visible.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.slice(0, 9).map((alert) => {
          const style = SEVERITY_STYLES[alert.severity];
          const Icon = style.icon;
          return (
            <Link
              key={alert.id}
              href={alert.href}
              className={`flex items-start gap-2 rounded-xl border ${style.border} ${style.bg} p-3 transition-colors hover:bg-opacity-20`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} />
              <div className="min-w-0 flex-1">
                <p className={`break-words text-sm font-semibold ${style.text}`}>{alert.title}</p>
                <p className="mt-1 truncate text-xs text-zinc-400">{alert.body}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

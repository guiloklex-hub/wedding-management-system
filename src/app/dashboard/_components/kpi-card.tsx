import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";

type Accent = "default" | "rose" | "emerald" | "amber" | "violet" | "champagne";

const ACCENT_TEXT: Record<Accent, string> = {
  default: "text-zinc-500",
  rose: "text-rose-500",
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  violet: "text-violet-500",
  champagne: "text-champagne-400",
};

const ACCENT_LINE: Record<Accent, string> = {
  default: "#a1a1aa",
  rose: "#f43f5e",
  emerald: "#22c55e",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  champagne: "#cbb170",
};

export function KpiCard({
  title,
  value,
  icon,
  accent = "default",
  trend,
  hint,
  href,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent?: Accent;
  trend?: Array<{ label: string; value: number }>;
  hint?: string;
  href?: string;
}) {
  const card = (
    <div className="h-full glass-premium glass-premium-hover rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400 tracking-wide">{title}</h3>
        <div className={`rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2 ${ACCENT_TEXT[accent]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="min-w-0 flex-1 break-words text-3xl font-bold tracking-tight text-zinc-100 font-display">
          {value}
        </span>
        {trend && trend.length > 1 ? (
          <div className="w-24 shrink-0 opacity-80 hover:opacity-100 transition-opacity">
            <Sparkline data={trend} stroke={ACCENT_LINE[accent]} />
          </div>
        ) : null}
      </div>
      {hint ? <p className="mt-2 break-words text-xs text-zinc-500 font-medium">{hint}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }
  return card;
}

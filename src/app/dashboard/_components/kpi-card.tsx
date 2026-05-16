import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";

type Accent = "default" | "rose" | "emerald" | "amber" | "violet";

const ACCENT_TEXT: Record<Accent, string> = {
  default: "text-zinc-500",
  rose: "text-rose-500",
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  violet: "text-violet-500",
};

const ACCENT_LINE: Record<Accent, string> = {
  default: "#a1a1aa",
  rose: "#f43f5e",
  emerald: "#22c55e",
  amber: "#f59e0b",
  violet: "#8b5cf6",
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
    <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm backdrop-blur-sm transition-all hover:bg-zinc-800/50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
        <div className={`rounded-lg border border-zinc-800 bg-zinc-800/50 p-2 ${ACCENT_TEXT[accent]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="text-3xl font-bold tracking-tight text-zinc-100">{value}</span>
        {trend && trend.length > 1 ? (
          <div className="w-24">
            <Sparkline data={trend} stroke={ACCENT_LINE[accent]} />
          </div>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-xs text-zinc-500">{hint}</p> : null}
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

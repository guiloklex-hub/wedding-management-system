"use client";

import { AlertTriangle } from "lucide-react";
import { StackedBar, type StackSeries } from "@/components/charts/stacked-bar";
import { RadialProgress } from "@/components/charts/radial-progress";
import { formatCurrency } from "@/lib/format";
import type { TrousseauProgress } from "@/lib/reports/trousseau-progress";

const STACK_SERIES: StackSeries[] = [
  { key: "GIFTED", label: "Recebidos", color: "#22c55e" },
  { key: "BOUGHT", label: "Comprados", color: "#3b82f6" },
  { key: "TO_BUY", label: "A comprar", color: "#71717a" },
];

const ROOM_LABEL: Record<string, string> = {
  KITCHEN: "Cozinha",
  BATHROOM: "Banheiro",
  BEDROOM: "Quarto",
  LIVING: "Sala",
  LAUNDRY: "Lavanderia",
  ELECTRONICS: "Eletrônicos",
  OTHER: "Outros",
};

export function TrousseauReportClient({
  result,
  showFinance,
}: {
  result: TrousseauProgress;
  showFinance: boolean;
}) {
  const byRoomData = result.byRoom.map((r) => ({
    name: ROOM_LABEL[r.room] ?? r.room,
    TO_BUY: r.counts.TO_BUY,
    BOUGHT: r.counts.BOUGHT,
    GIFTED: r.counts.GIFTED,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Tile label="Itens" value={String(result.totalCount)} />
        <Tile
          label="Conclusão"
          value={`${Math.round(result.completionPct * 100)}%`}
          color="text-emerald-400"
        />
        {showFinance ? (
          <Tile label="Estimado" value={formatCurrency(result.totalEstimated)} />
        ) : (
          <Tile label="Por cômodo" value={String(result.byRoom.length)} />
        )}
        {showFinance ? (
          <Tile label="Atual" value={formatCurrency(result.totalActual)} color="text-violet-400" />
        ) : (
          <Tile
            label="Essenciais pendentes"
            value={String(result.essentialsPending)}
            color={result.essentialsPending > 0 ? "text-amber-400" : "text-emerald-400"}
          />
        )}
      </div>

      {result.essentialsPending > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              {result.essentialsPending} item(ns) ESSENTIAL ainda em &quot;a comprar&quot;
            </p>
            <p className="mt-1 text-xs text-amber-200/80">
              Priorize esses antes de itens NICE_TO_HAVE ou LUXURY.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-zinc-200">Progresso geral</h2>
          <RadialProgress
            value={result.completionPct}
            max={1}
            label="Concluído"
            sublabel={`${Math.round(result.completionPct * 100)}% de ${result.totalCount} itens`}
            color="#22c55e"
          />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Por cômodo</h2>
          {byRoomData.length > 0 ? (
            <StackedBar
              data={byRoomData}
              series={STACK_SERIES}
              horizontal
              height={Math.max(220, byRoomData.length * 36 + 60)}
            />
          ) : (
            <p className="text-sm text-zinc-500">Nenhum item adicionado ao enxoval ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  color = "text-zinc-100",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

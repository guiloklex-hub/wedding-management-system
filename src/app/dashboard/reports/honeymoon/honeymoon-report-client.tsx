"use client";

import { StackedBar, type StackSeries } from "@/components/charts/stacked-bar";
import { RadialProgress } from "@/components/charts/radial-progress";
import { formatCurrency } from "@/lib/format";
import type { HoneymoonProgress } from "@/lib/reports/honeymoon-progress";

const STACK_SERIES: StackSeries[] = [
  { key: "PAID", label: "Pago", color: "#22c55e" },
  { key: "CONFIRMED", label: "Confirmado", color: "#8b5cf6" },
  { key: "BOOKED", label: "Reservado", color: "#3b82f6" },
  { key: "PLANNED", label: "Planejado", color: "#71717a" },
  { key: "CANCELLED", label: "Cancelado", color: "#f43f5e" },
];

const KIND_LABEL: Record<string, string> = {
  FLIGHT: "Voos",
  HOTEL: "Hospedagem",
  TRANSFER: "Translado",
  ACTIVITY: "Atividades",
  DOCUMENT: "Documentos",
  BAGGAGE: "Bagagem",
  OTHER: "Outros",
};

export function HoneymoonReportClient({ result }: { result: HoneymoonProgress }) {
  const byKindData = result.byKind.map((k) => ({
    name: KIND_LABEL[k.kind] ?? k.kind,
    PAID: k.counts.PAID,
    CONFIRMED: k.counts.CONFIRMED,
    BOOKED: k.counts.BOOKED,
    PLANNED: k.counts.PLANNED,
    CANCELLED: k.counts.CANCELLED,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Tile label="Itens" value={String(result.itemsCount)} />
        <Tile label="Reservado" value={formatCurrency(result.bookedBRL)} color="text-violet-400" />
        <Tile label="Pago" value={formatCurrency(result.paidBRL)} color="text-emerald-400" />
        <Tile
          label="Recebido via PIX (cota)"
          value={formatCurrency(result.fundedFromGiftsBRL)}
          color="text-amber-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-zinc-200">Cobertura por cota</h2>
          {result.budgetBRL !== null && result.budgetBRL > 0 ? (
            <RadialProgress
              value={result.fundedFromGiftsBRL}
              max={result.budgetBRL}
              label={`${formatCurrency(result.fundedFromGiftsBRL)} / ${formatCurrency(result.budgetBRL)}`}
              sublabel="contribuições via PIX"
              color="#22c55e"
            />
          ) : (
            <p className="text-sm text-zinc-500">Defina um orçamento total para a lua de mel para ver a cobertura.</p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Por tipo de item</h2>
          {byKindData.length > 0 ? (
            <StackedBar
              data={byKindData}
              series={STACK_SERIES}
              horizontal
              height={Math.max(220, byKindData.length * 36 + 60)}
            />
          ) : (
            <p className="text-sm text-zinc-500">Nenhum item adicionado à lua de mel ainda.</p>
          )}
        </div>
      </div>

      {Object.keys(result.byCurrency).filter((c) => c !== "BRL").length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="text-sm font-semibold text-amber-300">Valores em moedas estrangeiras</h3>
          <p className="mt-1 text-xs text-amber-200/80">
            Os totais acima exibem valores em BRL. Itens em outras moedas:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100">
            {Object.entries(result.byCurrency)
              .filter(([k]) => k !== "BRL")
              .map(([currency, total]) => (
                <li key={currency}>
                  {currency}: {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
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

"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, Save } from "lucide-react";
import { updateSettings } from "@/app/actions/settingsActions";
import { useToast } from "@/components/toast";

type InitialSettings = {
  eventDate: string;
  contingencyPercent: number;
  currency: string;
  coupleNames: string;
};

export default function SettingsClient({ initial }: { initial: InitialSettings }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [isPending, setPending] = useState(false);

  function handleSubmit(formData: FormData) {
    setPending(true);
    startTransition(async () => {
      try {
        const r = await updateSettings(undefined, formData);
        if (r.success) {
          toast.success("Configurações salvas");
        } else {
          toast.error("Falha ao salvar", r.error);
        }
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Casamento</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Data do evento, fundo de contingência e moeda padrão.
        </p>
        <form action={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Nomes do casal</label>
            <input
              type="text"
              name="coupleNames"
              defaultValue={initial.coupleNames}
              maxLength={120}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              placeholder="Ex: Guilherme & Mariana"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Data do evento</label>
              <input
                type="date"
                name="eventDate"
                required
                defaultValue={initial.eventDate}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Moeda</label>
              <select
                name="currency"
                defaultValue={initial.currency}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              >
                <option value="BRL">Real (BRL)</option>
                <option value="USD">Dólar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">
              Fundo de contingência (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              name="contingencyPercent"
              required
              defaultValue={initial.contingencyPercent}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Reserva calculada em cima do total contratado. Padrão: 10%.
            </p>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Salvar</span>
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Backup</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Baixa um JSON com todos os fornecedores, pagamentos, aportes e configurações.
        </p>
        <a
          href="/api/backup"
          download
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <Download className="h-4 w-4" />
          <span>Exportar backup JSON</span>
        </a>
        <p className="mt-3 text-xs text-zinc-500">
          Recomendado fazer um backup mensal. O arquivo pode ser usado para auditoria ou para
          restaurar dados manualmente (a restauração ainda é manual via prisma studio).
        </p>
      </section>
    </div>
  );
}

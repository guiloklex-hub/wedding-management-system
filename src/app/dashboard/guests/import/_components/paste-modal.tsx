"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, X } from "lucide-react";
import { useToast } from "@/components/toast";
import { bulkImportGuests } from "@/app/actions/guestActions";

export function PasteImportModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await bulkImportGuests(undefined, formData);
        if (r.success && r.data) {
          const groupsMsg =
            r.data.groupsCreated > 0
              ? `, ${r.data.groupsCreated} grupo(s) criado(s)`
              : "";
          toast.success(
            `${r.data.created} importados`,
            `${r.data.skipped} linhas puladas${groupsMsg}`,
          );
          onClose();
          router.refresh();
        } else if (!r.success) {
          toast.error("Falha", r.error);
        }
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Colar texto bruto</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-300 hover:bg-zinc-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          Cole linhas no formato{" "}
          <code className="rounded bg-zinc-800 px-1">Nome,Telefone,Email,Lado,Grupo</code>{" "}
          (uma linha por convidado). Telefone, email, lado e grupo são opcionais. Lado aceita
          NOIVO/NOIVA/AMBOS. Quando a coluna <strong>Grupo</strong> for preenchida, grupos novos
          são criados automaticamente (e os existentes reaproveitados, comparando pelo nome) —
          convidados da mesma família passam a compartilhar um único link de RSVP.
        </p>
        <form action={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Conteúdo</label>
            <textarea
              name="raw"
              required
              rows={10}
              placeholder={`Maria Silva,+5511999990000,maria@example.com,NOIVA,Família\nJoão Souza\nAna,,ana@example.com,,Trabalho dele`}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Separador</label>
            <select
              name="separator"
              defaultValue="AUTO"
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="AUTO">Detectar automaticamente</option>
              <option value="COMMA">, (vírgula)</option>
              <option value="SEMICOLON">; (ponto-vírgula)</option>
              <option value="TAB">Tab</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-zinc-800 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4 rotate-90" />
              )}
              Importar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

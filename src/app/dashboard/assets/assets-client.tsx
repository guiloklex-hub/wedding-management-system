"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { createAsset, deleteAsset, updateAsset } from "@/app/actions/assetActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency, formatDateBR, toIsoDate } from "@/lib/format";
import type { Asset } from "@/types";

type Props = { assets: Asset[] };

export default function AssetsClient({ assets }: Props) {
  const toast = useToast();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [isCreating, setCreating] = useState(false);
  const [isUpdating, setUpdating] = useState(false);

  function handleCreate(formData: FormData) {
    setCreating(true);
    startTransition(async () => {
      try {
        const r = await createAsset(undefined, formData);
        if (r.success) {
          toast.success("Aporte registrado");
          setCreateOpen(false);
        } else {
          toast.error("Falha", r.error);
        }
      } finally {
        setCreating(false);
      }
    });
  }

  function handleUpdate(formData: FormData) {
    setUpdating(true);
    startTransition(async () => {
      try {
        const r = await updateAsset(undefined, formData);
        if (r.success) {
          toast.success("Aporte atualizado");
          setEditing(null);
        } else {
          toast.error("Falha", r.error);
        }
      } finally {
        setUpdating(false);
      }
    });
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return assets;
    return assets.filter((a) => a.title.toLowerCase().includes(term));
  }, [assets, search]);

  const total = useMemo(() => assets.reduce((s, a) => s + a.amount, 0), [assets]);

  function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const r = await deleteAsset(target.id);
      if (r.success) {
        toast.success("Aporte excluído");
        setDeleting(null);
      } else {
        toast.error("Falha", r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aporte..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
            />
          </div>
          <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Total: {formatCurrency(total)}
          </span>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Aporte</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-medium">Data</th>
                <th className="px-6 py-4 font-medium">Origem</th>
                <th className="px-6 py-4 font-medium">Valor</th>
                <th className="px-6 py-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                    {assets.length === 0 ? "Nenhum aporte registrado." : "Nenhum resultado para o filtro."}
                  </td>
                </tr>
              ) : (
                filtered.map((asset) => (
                  <tr key={asset.id} className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30">
                    <td className="px-6 py-4 text-zinc-200">{formatDateBR(asset.date)}</td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-200">{asset.title}</div>
                      {asset.notes ? <div className="mt-0.5 text-xs text-zinc-500">{asset.notes}</div> : null}
                    </td>
                    <td className="px-6 py-4 font-medium text-emerald-400">{formatCurrency(asset.amount)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(asset)}
                          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(asset)}
                          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(isCreateOpen || editing) && (
        <AssetFormModal
          mode={editing ? "edit" : "create"}
          asset={editing ?? undefined}
          isBusy={editing ? isUpdating : isCreating}
          formAction={editing ? handleUpdate : handleCreate}
          onClose={() => {
            setCreateOpen(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Excluir aporte?"
        description={deleting ? `${deleting.title} · ${formatCurrency(deleting.amount)}` : undefined}
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function AssetFormModal({
  mode,
  asset,
  isBusy,
  formAction,
  onClose,
}: {
  mode: "create" | "edit";
  asset?: Asset;
  isBusy: boolean;
  formAction: (formData: FormData) => void;
  onClose: () => void;
}) {
  const todayIso = toIsoDate(new Date());
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <form action={formAction} className="space-y-4 p-6">
          <h2 className="text-xl font-bold text-white">{mode === "create" ? "Novo aporte" : "Editar aporte"}</h2>

          {asset ? <input type="hidden" name="id" value={asset.id} /> : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Título / Origem</label>
            <input
              type="text"
              name="title"
              required
              defaultValue={asset?.title ?? ""}
              maxLength={120}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-emerald-500/50"
              placeholder="Ex: Salário de Março"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                name="amount"
                required
                defaultValue={asset?.amount ?? ""}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Data</label>
              <input
                type="date"
                name="date"
                required
                defaultValue={asset ? toIsoDate(new Date(asset.date)) : todayIso}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Notas</label>
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={asset?.notes ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="flex flex-1 items-center justify-center rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

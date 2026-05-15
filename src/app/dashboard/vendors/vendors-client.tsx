"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Loader2, Pencil, Trash2, Search, Star } from "lucide-react";
import {
  createVendor,
  updateVendor,
  updateVendorStatus,
  deleteVendor,
} from "@/app/actions/vendorActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency } from "@/lib/format";
import type { CategoryDef } from "@/lib/categories";
import type { Vendor, BudgetItem, VendorStatus } from "@/types";

type VendorRow = Vendor & { budgetItems: BudgetItem[] };

type Props = {
  vendors: VendorRow[];
  categories: CategoryDef[];
};

const STATUS_LABEL: Record<VendorStatus, string> = {
  NEGOTIATION: "Em Negociação",
  CONTRACTED: "Contratado",
  FINALIZED: "Finalizado",
};

const STATUS_CHIP: Record<VendorStatus, string> = {
  NEGOTIATION: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CONTRACTED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  FINALIZED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default function VendorsClient({ vendors, categories }: Props) {
  const toast = useToast();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [deleting, setDeleting] = useState<VendorRow | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | VendorStatus>("ALL");
  const [isPendingTransition, startTransition] = useTransition();
  const [isCreating, setCreating] = useState(false);
  const [isUpdating, setUpdating] = useState(false);

  function handleCreate(formData: FormData) {
    setCreating(true);
    startTransition(async () => {
      try {
        const r = await createVendor(undefined, formData);
        if (r.success) {
          toast.success("Fornecedor criado");
          setCreateOpen(false);
        } else {
          toast.error("Falha ao criar", r.error);
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
        const r = await updateVendor(undefined, formData);
        if (r.success) {
          toast.success("Fornecedor atualizado");
          setEditing(null);
        } else {
          toast.error("Falha ao atualizar", r.error);
        }
      } finally {
        setUpdating(false);
      }
    });
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
      if (term && !`${v.name} ${v.category}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [vendors, search, statusFilter]);

  function handleStatusChange(vendor: VendorRow, newStatus: VendorStatus) {
    const item = vendor.budgetItems[0];
    const hasActual = !!item?.actualValue;
    let actual: number | undefined;

    if (newStatus === "CONTRACTED" && !hasActual) {
      const raw = window.prompt(
        `Qual o valor REAL contratado com ${vendor.name}? (apenas números, ex: 12500.00)`,
        String(item?.estimatedValue ?? ""),
      );
      if (raw === null) return;
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Valor inválido");
        return;
      }
      actual = n;
    }

    startTransition(async () => {
      const r = await updateVendorStatus(vendor.id, newStatus, actual);
      if (r.success) toast.success("Status atualizado");
      else toast.error("Falha", r.error);
    });
  }

  function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const r = await deleteVendor(target.id);
      if (r.success) {
        toast.success("Fornecedor excluído");
        setDeleting(null);
      } else {
        toast.error("Falha ao excluir", r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar fornecedor..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | VendorStatus)}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
          >
            <option value="ALL">Todos os status</option>
            <option value="NEGOTIATION">Em Negociação</option>
            <option value="CONTRACTED">Contratado</option>
            <option value="FINALIZED">Finalizado</option>
          </select>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Fornecedor</span>
        </button>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Categoria</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Valor</th>
                <th className="px-6 py-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    {vendors.length === 0 ? "Nenhum fornecedor cadastrado." : "Nenhum resultado para o filtro."}
                  </td>
                </tr>
              ) : (
                filtered.map((vendor) => {
                  const budget = vendor.budgetItems[0];
                  const value = budget?.actualValue ?? budget?.estimatedValue ?? 0;
                  const isReal = budget?.actualValue != null;
                  const status = vendor.status as VendorStatus;
                  const category = categories.find((c) => c.key === vendor.categoryKey);

                  return (
                    <tr key={vendor.id} className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30">
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/vendors/${vendor.id}`}
                          className="font-medium text-zinc-200 hover:text-rose-300"
                        >
                          {vendor.name}
                        </Link>
                        {vendor.rating ? (
                          <div className="mt-0.5 flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < (vendor.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-zinc-700"
                                }`}
                              />
                            ))}
                          </div>
                        ) : null}
                        {vendor.notes ? (
                          <div className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{vendor.notes}</div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: category?.color ?? "#71717a" }}
                          />
                          <span>{category?.label ?? vendor.category}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={vendor.status}
                          onChange={(e) => handleStatusChange(vendor, e.target.value as VendorStatus)}
                          disabled={isPendingTransition}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium outline-none ${STATUS_CHIP[status]}`}
                        >
                          <option value="NEGOTIATION">Em Negociação</option>
                          <option value="CONTRACTED">Contratado</option>
                          <option value="FINALIZED">Finalizado</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-zinc-300">{formatCurrency(value)}</span>
                        <span className="ml-2 text-xs text-zinc-600">({isReal ? "Real" : "Estimado"})</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing(vendor)}
                            aria-label="Editar"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(vendor)}
                            aria-label="Excluir"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-500">
            {vendors.length === 0 ? "Nenhum fornecedor cadastrado." : "Nenhum resultado para o filtro."}
          </div>
        ) : (
          filtered.map((vendor) => {
            const budget = vendor.budgetItems[0];
            const value = budget?.actualValue ?? budget?.estimatedValue ?? 0;
            const isReal = budget?.actualValue != null;
            const status = vendor.status as VendorStatus;
            const category = categories.find((c) => c.key === vendor.categoryKey);
            return (
              <div key={vendor.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: category?.color ?? "#71717a" }}
                      />
                      <span className="text-xs text-zinc-400">{category?.label ?? vendor.category}</span>
                    </div>
                    <Link
                      href={`/dashboard/vendors/${vendor.id}`}
                      className="mt-1 block truncate font-semibold text-zinc-100 hover:text-rose-300"
                    >
                      {vendor.name}
                    </Link>
                    <div className="mt-2 text-sm text-zinc-300">
                      {formatCurrency(value)}{" "}
                      <span className="text-xs text-zinc-500">({isReal ? "Real" : "Estimado"})</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(vendor)}
                        className="rounded-lg bg-zinc-800/60 p-1.5 text-zinc-300"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(vendor)}
                        className="rounded-lg bg-zinc-800/60 p-1.5 text-rose-400"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <select
                  value={vendor.status}
                  onChange={(e) => handleStatusChange(vendor, e.target.value as VendorStatus)}
                  disabled={isPendingTransition}
                  className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none"
                >
                  <option value="NEGOTIATION">Em Negociação</option>
                  <option value="CONTRACTED">Contratado</option>
                  <option value="FINALIZED">Finalizado</option>
                </select>
              </div>
            );
          })
        )}
      </div>

      {isCreateOpen && (
        <VendorFormModal
          mode="create"
          categories={categories}
          isBusy={isCreating}
          onClose={() => setCreateOpen(false)}
          formAction={handleCreate}
        />
      )}

      {editing && (
        <VendorFormModal
          mode="edit"
          vendor={editing}
          categories={categories}
          isBusy={isUpdating}
          onClose={() => setEditing(null)}
          formAction={handleUpdate}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={deleting ? `Excluir ${deleting.name}?` : "Excluir fornecedor?"}
        description={
          "Essa ação fará exclusão lógica do fornecedor, seus orçamentos e pagamentos associados.\nVocê não verá mais esses registros nas listagens."
        }
        confirmLabel="Excluir"
        tone="danger"
        busy={isPendingTransition}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function VendorFormModal({
  mode,
  vendor,
  categories,
  isBusy,
  formAction,
  onClose,
}: {
  mode: "create" | "edit";
  vendor?: VendorRow;
  categories: CategoryDef[];
  isBusy: boolean;
  formAction: (formData: FormData) => void;
  onClose: () => void;
}) {
  const budget = vendor?.budgetItems[0];
  const defaultEstimated = budget?.estimatedValue ?? 0;
  const defaultActual = budget?.actualValue ?? "";
  const initialKey = vendor?.categoryKey ?? "";
  const [categoryKey, setCategoryKey] = useState(initialKey);

  const selectedCategory = useMemo(() => categories.find((c) => c.key === categoryKey), [categoryKey, categories]);
  const categoryLabel = selectedCategory?.label ?? vendor?.category ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <form action={formAction} className="space-y-4 p-6">
          <h2 className="text-xl font-bold text-white">
            {mode === "create" ? "Novo Fornecedor" : `Editar ${vendor?.name ?? ""}`}
          </h2>

          {mode === "edit" && vendor ? <input type="hidden" name="id" value={vendor.id} /> : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Nome</label>
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              defaultValue={vendor?.name ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              placeholder="Ex: Buffet Colonial"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Categoria</label>
              <select
                name="categoryKey"
                value={categoryKey}
                onChange={(e) => setCategoryKey(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              >
                <option value="">— escolher —</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Rótulo livre</label>
              <input
                type="text"
                name="category"
                required
                maxLength={80}
                defaultValue={categoryLabel}
                key={categoryKey}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                placeholder="Ex: Alimentação"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">
                Valor {mode === "create" ? "estimado" : "estimado"} (R$)
              </label>
              <input
                type="number"
                step="0.01"
                name="estimatedValue"
                required={mode === "create"}
                defaultValue={defaultEstimated ? String(defaultEstimated) : ""}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                placeholder="Ex: 15000.00"
              />
            </div>
            {mode === "edit" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-400">Valor real (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  name="actualValue"
                  defaultValue={defaultActual ? String(defaultActual) : ""}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
                  placeholder="Vazio = ainda não fechado"
                />
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Status</label>
            <select
              name="status"
              defaultValue={vendor?.status ?? "NEGOTIATION"}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
            >
              <option value="NEGOTIATION">Em Negociação</option>
              <option value="CONTRACTED">Contratado</option>
              <option value="FINALIZED">Finalizado</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Link do contrato (opcional)</label>
            <input
              type="url"
              name="contractLink"
              defaultValue={vendor?.contractLink ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Notas</label>
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={vendor?.notes ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-zinc-200 outline-none focus:border-rose-500/50"
              placeholder="Observações, contatos, condições..."
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
              className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "create" ? "Salvar" : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

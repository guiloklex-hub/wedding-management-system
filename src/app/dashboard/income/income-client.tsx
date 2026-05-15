"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createIncome,
  deleteIncome,
  markIncomeReceived,
  updateIncome,
} from "@/app/actions/incomeActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency, formatDateBR, toIsoDate } from "@/lib/format";

type IncomeRow = {
  id: string;
  title: string;
  source: string;
  amount: number;
  expectedDate: Date | null;
  receivedAt: Date | null;
  status: string;
  frequency: string;
  givenByName: string | null;
  notes: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  SALARY: "Salário",
  BONUS: "Bônus / 13º",
  GIFT: "Presente em dinheiro",
  FREELANCE: "Freela",
  SALE: "Venda",
  RESTITUTION: "Restituição IR",
  OTHER: "Outro",
};

export default function IncomeClient({ incomes }: { incomes: IncomeRow[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeRow | null>(null);
  const [deleting, setDeleting] = useState<IncomeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatingBusy, setUpdatingBusy] = useState(false);
  const [, startTransition] = useTransition();

  const totals = useMemo(() => {
    let expected = 0;
    let received = 0;
    for (const i of incomes) {
      if (i.status === "CANCELLED") continue;
      if (i.status === "RECEIVED") received += i.amount;
      else expected += i.amount;
    }
    return { expected, received, total: expected + received };
  }, [incomes]);

  function handleCreate(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createIncome(undefined, formData);
        if (r.success) {
          toast.success("Receita registrada");
          setOpen(false);
        } else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleUpdate(formData: FormData) {
    setUpdatingBusy(true);
    startTransition(async () => {
      try {
        const r = await updateIncome(undefined, formData);
        if (r.success) {
          toast.success("Receita atualizada");
          setEditing(null);
        } else toast.error("Falha", r.error);
      } finally {
        setUpdatingBusy(false);
      }
    });
  }

  function handleReceived(row: IncomeRow) {
    startTransition(async () => {
      const r = await markIncomeReceived(row.id);
      if (r.success) toast.success("Marcada como recebida");
      else toast.error("Falha", r.error);
    });
  }

  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const r = await deleteIncome(id);
      if (r.success) {
        toast.success("Receita removida");
        setDeleting(null);
      } else toast.error("Falha", r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total estimado" value={totals.total} accent="zinc" />
        <SummaryCard label="A receber" value={totals.expected} accent="amber" />
        <SummaryCard label="Recebido" value={totals.received} accent="emerald" />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" /> Nova receita
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-medium">Título</th>
                <th className="px-6 py-4 font-medium">Origem</th>
                <th className="px-6 py-4 font-medium">Valor</th>
                <th className="px-6 py-4 font-medium">Data prevista</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {incomes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    Nenhuma receita cadastrada.
                  </td>
                </tr>
              ) : (
                incomes.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-6 py-4">
                      <div className="text-zinc-200">{row.title}</div>
                      {row.givenByName ? (
                        <div className="text-xs text-zinc-500">de {row.givenByName}</div>
                      ) : null}
                      {row.frequency === "MONTHLY" ? (
                        <div className="text-[10px] uppercase tracking-wider text-sky-400">Mensal</div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">{SOURCE_LABEL[row.source] ?? row.source}</td>
                    <td className="px-6 py-4 font-medium text-emerald-400">{formatCurrency(row.amount)}</td>
                    <td className="px-6 py-4">{row.expectedDate ? formatDateBR(row.expectedDate) : "—"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          row.status === "RECEIVED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : row.status === "CANCELLED"
                              ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {row.status === "RECEIVED" ? "Recebida" : row.status === "CANCELLED" ? "Cancelada" : "Prevista"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {row.status === "EXPECTED" ? (
                          <button
                            type="button"
                            onClick={() => handleReceived(row)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-emerald-400 hover:bg-emerald-500/10"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">Recebi</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          aria-label="Editar"
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(row)}
                          aria-label="Excluir"
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
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

      {(open || editing) && (
        <IncomeFormModal
          mode={editing ? "edit" : "create"}
          income={editing ?? undefined}
          isBusy={editing ? updatingBusy : busy}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          formAction={editing ? handleUpdate : handleCreate}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Excluir receita?"
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "zinc" | "amber" | "emerald";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-300"
      : accent === "emerald"
        ? "text-emerald-300"
        : "text-zinc-200";
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function IncomeFormModal({
  mode,
  income,
  isBusy,
  onClose,
  formAction,
}: {
  mode: "create" | "edit";
  income?: IncomeRow;
  isBusy: boolean;
  onClose: () => void;
  formAction: (formData: FormData) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm">
      <div className="my-8 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white">
          {mode === "create" ? "Nova receita" : "Editar receita"}
        </h2>
        <form action={formAction} className="mt-4 space-y-3">
          {income ? <input type="hidden" name="id" value={income.id} /> : null}
          <Field name="title" label="Título" required defaultValue={income?.title ?? ""} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Origem</label>
              <select
                name="source"
                defaultValue={income?.source ?? "SALARY"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <Field
              name="amount"
              label="Valor (R$)"
              type="number"
              step="0.01"
              required
              defaultValue={income?.amount.toString() ?? ""}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              name="expectedDate"
              label="Data prevista"
              type="date"
              defaultValue={
                income?.expectedDate ? toIsoDate(new Date(income.expectedDate)) : ""
              }
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Frequência</label>
              <select
                name="frequency"
                defaultValue={income?.frequency ?? "ONE_TIME"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="ONE_TIME">Avulsa</option>
                <option value="MONTHLY">Mensal</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Status</label>
              <select
                name="status"
                defaultValue={income?.status ?? "EXPECTED"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="EXPECTED">Prevista</option>
                <option value="RECEIVED">Recebida</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>
            <Field
              name="givenByName"
              label="Dado por (presente)"
              defaultValue={income?.givenByName ?? ""}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Notas</label>
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={income?.notes ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
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
              disabled={isBusy}
              className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  step,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  step?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        step={step}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

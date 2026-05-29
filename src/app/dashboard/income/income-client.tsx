"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createIncome,
  deleteIncome,
  markIncomeReceived,
  updateIncome,
} from "@/app/actions/incomeActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination, usePagination } from "@/components/pagination";
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

const SOURCE_KEYS = [
  "SALARY",
  "BONUS",
  "GIFT",
  "FREELANCE",
  "SALE",
  "RESTITUTION",
  "OTHER",
] as const;

export default function IncomeClient({ incomes }: { incomes: IncomeRow[] }) {
  const t = useTranslations("dashboard.income");
  const tc = useTranslations("common");
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

  const { pageItems, page, totalPages, total, from, to, setPage } = usePagination(incomes, 20);

  function sourceLabel(source: string): string {
    return SOURCE_KEYS.includes(source as (typeof SOURCE_KEYS)[number])
      ? t(`source.${source}`)
      : source;
  }

  function handleCreate(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createIncome(undefined, formData);
        if (r.success) {
          toast.success(t("toast.created"));
          setOpen(false);
        } else toast.error(t("toast.fail"), r.error);
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
          toast.success(t("toast.updated"));
          setEditing(null);
        } else toast.error(t("toast.fail"), r.error);
      } finally {
        setUpdatingBusy(false);
      }
    });
  }

  function handleReceived(row: IncomeRow) {
    startTransition(async () => {
      const r = await markIncomeReceived(row.id);
      if (r.success) toast.success(t("toast.marked"));
      else toast.error(t("toast.fail"), r.error);
    });
  }

  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const r = await deleteIncome(id);
      if (r.success) {
        toast.success(t("toast.deleted"));
        setDeleting(null);
      } else toast.error(t("toast.fail"), r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label={t("summary.total")} value={totals.total} accent="zinc" />
        <SummaryCard label={t("summary.expected")} value={totals.expected} accent="amber" />
        <SummaryCard label={t("summary.received")} value={totals.received} accent="emerald" />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" /> {t("actions.new")}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-medium">{t("table.title")}</th>
                <th className="px-6 py-4 font-medium">{t("table.source")}</th>
                <th className="px-6 py-4 font-medium">{t("table.amount")}</th>
                <th className="px-6 py-4 font-medium">{t("table.expectedDate")}</th>
                <th className="px-6 py-4 font-medium">{t("table.status")}</th>
                <th className="px-6 py-4 text-right font-medium">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {incomes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    {t("table.empty")}
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-6 py-4">
                      <div className="text-zinc-200">{row.title}</div>
                      {row.givenByName ? (
                        <div className="text-xs text-zinc-500">{t("row.givenBy", { name: row.givenByName })}</div>
                      ) : null}
                      {row.frequency === "MONTHLY" ? (
                        <div className="text-[10px] uppercase tracking-wider text-sky-400">{t("frequency.MONTHLY")}</div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">{sourceLabel(row.source)}</td>
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
                        {row.status === "RECEIVED"
                          ? t("status.RECEIVED")
                          : row.status === "CANCELLED"
                            ? t("status.CANCELLED")
                            : t("status.EXPECTED")}
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
                            <span className="text-xs">{t("actions.received")}</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          aria-label={tc("actions.edit")}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(row)}
                          aria-label={tc("actions.delete")}
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

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        from={from}
        to={to}
        onPageChange={setPage}
      />

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
        title={t("confirmDelete.title")}
        confirmLabel={tc("actions.delete")}
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
  const t = useTranslations("dashboard.income");
  const tc = useTranslations("common");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">
          {mode === "create" ? t("form.titleCreate") : t("form.titleEdit")}
        </h2>
        <form action={formAction} className="mt-4 space-y-3">
          {income ? <input type="hidden" name="id" value={income.id} /> : null}
          <Field name="title" label={t("form.title")} required defaultValue={income?.title ?? ""} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.source")}</label>
              <select
                name="source"
                defaultValue={income?.source ?? "SALARY"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                {SOURCE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {t(`source.${k}`)}
                  </option>
                ))}
              </select>
            </div>
            <Field
              name="amount"
              label={t("form.amount")}
              type="number"
              step="0.01"
              required
              defaultValue={income?.amount.toString() ?? ""}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              name="expectedDate"
              label={t("form.expectedDate")}
              type="date"
              defaultValue={
                income?.expectedDate ? toIsoDate(new Date(income.expectedDate)) : ""
              }
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.frequency")}</label>
              <select
                name="frequency"
                defaultValue={income?.frequency ?? "ONE_TIME"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="ONE_TIME">{t("frequency.ONE_TIME")}</option>
                <option value="MONTHLY">{t("frequency.MONTHLY")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.status")}</label>
              <select
                name="status"
                defaultValue={income?.status ?? "EXPECTED"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="EXPECTED">{t("status.EXPECTED")}</option>
                <option value="RECEIVED">{t("status.RECEIVED")}</option>
                <option value="CANCELLED">{t("status.CANCELLED")}</option>
              </select>
            </div>
            <Field
              name="givenByName"
              label={t("form.givenByName")}
              defaultValue={income?.givenByName ?? ""}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.notes")}</label>
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
              {tc("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("actions.save")}
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

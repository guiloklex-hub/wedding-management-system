"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { createGoal, deleteGoal, updateGoal } from "@/app/actions/goalActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency, formatDateBR, toIsoDate } from "@/lib/format";

type GoalRow = {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: Date | null;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
  current: number;
  assetCount: number;
};

export default function GoalsClient({ goals }: { goals: GoalRow[] }) {
  const t = useTranslations("dashboard.goals");
  const tc = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GoalRow | null>(null);
  const [deleting, setDeleting] = useState<GoalRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatingBusy, setUpdatingBusy] = useState(false);
  const [, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createGoal(undefined, formData);
        if (r.success) {
          toast.success(t("toast.created"));
          setOpen(false);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleUpdate(formData: FormData) {
    setUpdatingBusy(true);
    startTransition(async () => {
      try {
        const r = await updateGoal(undefined, formData);
        if (r.success) {
          toast.success(t("toast.updated"));
          setEditing(null);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setUpdatingBusy(false);
      }
    });
  }

  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const r = await deleteGoal(id);
      if (r.success) {
        toast.success(t("toast.removed"));
        setDeleting(null);
      } else toast.error(t("toast.failed"), r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" /> {t("list.new")}
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          {t("list.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const pct = g.targetAmount > 0 ? Math.min((g.current / g.targetAmount) * 100, 100) : 0;
            const remaining = Math.max(g.targetAmount - g.current, 0);
            const monthsLeft = g.targetDate
              ? Math.max(
                  Math.ceil(
                    (new Date(g.targetDate).getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24 * 30),
                  ),
                  0,
                )
              : null;
            const monthlyNeed = monthsLeft && monthsLeft > 0 ? remaining / monthsLeft : null;

            return (
              <article
                key={g.id}
                className={`relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.01] shadow-lg flex flex-col justify-between group min-h-[220px] ${
                  g.imageUrl
                    ? "border border-zinc-800/80 bg-zinc-950"
                    : "glass-premium glass-premium-hover"
                }`}
              >
                {g.imageUrl ? (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 opacity-25 group-hover:opacity-35"
                      style={{ backgroundImage: `url(${g.imageUrl})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-900/40" />
                  </>
                ) : null}

                <div className="relative z-10 flex-1 flex flex-col justify-between space-y-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Target className={`h-5 w-5 ${pct >= 100 ? "text-champagne-400 animate-pulse" : "text-rose-400"}`} />
                        <h3 className="text-lg font-semibold text-zinc-100 font-serif leading-snug truncate">{g.name}</h3>
                        {!g.isActive ? (
                          <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-400">
                            {t("card.inactive")}
                          </span>
                        ) : null}
                      </div>
                      {g.targetDate ? (
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {t("card.target", { date: formatDateBR(g.targetDate) })}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(g)}
                        aria-label={tc("actions.edit")}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(g)}
                        aria-label={tc("actions.delete")}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-end justify-between text-xs text-zinc-400 font-medium">
                        <span className="font-display">{formatCurrency(g.current)}</span>
                        <span className="font-display">{formatCurrency(g.targetAmount)}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-900/60 border border-zinc-800/30">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            pct >= 100
                              ? "bg-gradient-to-r from-champagne-500 to-champagne-300"
                              : "bg-gradient-to-r from-rose-500 to-rose-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                        <span>{t("card.pctReached", { pct: pct.toFixed(1) })}</span>
                        <span>{t("card.contributions", { count: g.assetCount })}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Mini label={t("card.remaining")}>{formatCurrency(remaining)}</Mini>
                      <Mini label={t("card.perMonth")}>
                        {monthlyNeed ? formatCurrency(monthlyNeed) : "—"}
                      </Mini>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {(open || editing) && (
        <GoalFormModal
          mode={editing ? "edit" : "create"}
          goal={editing ?? undefined}
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
        title={t("delete.title")}
        description={t("delete.description")}
        confirmLabel={tc("actions.delete")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-sm font-medium text-zinc-200">{children}</p>
    </div>
  );
}

function GoalFormModal({
  mode,
  goal,
  isBusy,
  onClose,
  formAction,
}: {
  mode: "create" | "edit";
  goal?: GoalRow;
  isBusy: boolean;
  onClose: () => void;
  formAction: (formData: FormData) => void;
}) {
  const t = useTranslations("dashboard.goals");
  const tc = useTranslations("common");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">
          {mode === "create" ? t("form.createTitle") : t("form.editTitle")}
        </h2>
        <form action={formAction} className="mt-4 space-y-3">
          {goal ? <input type="hidden" name="id" value={goal.id} /> : null}
          <Field name="name" label={t("form.name")} required defaultValue={goal?.name ?? ""} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              name="targetAmount"
              label={t("form.targetAmount")}
              type="number"
              step="0.01"
              required
              defaultValue={goal?.targetAmount.toString() ?? ""}
            />
            <Field
              name="targetDate"
              label={t("form.targetDate")}
              type="date"
              defaultValue={goal?.targetDate ? toIsoDate(new Date(goal.targetDate)) : ""}
            />
          </div>
          <Field
            name="imageUrl"
            label={t("form.imageUrl")}
            placeholder={t("form.imageUrlPlaceholder")}
            defaultValue={goal?.imageUrl ?? ""}
            type="url"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={goal?.isActive ?? true}
              className="accent-rose-500"
            />
            {t("form.isActive")}
          </label>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.notes")}</label>
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={goal?.notes ?? ""}
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
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  step?: string;
  defaultValue?: string;
  placeholder?: string;
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
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

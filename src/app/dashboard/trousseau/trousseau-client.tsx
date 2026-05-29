"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  ExternalLink,
  Gift,
  Loader2,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import {
  createTrousseauItem,
  deleteTrousseauItem,
  setTrousseauStatus,
  updateTrousseauItem,
} from "@/app/actions/trousseauActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination, usePagination } from "@/components/pagination";
import { formatCurrency } from "@/lib/format";

type TFn = (key: string) => string;

const ROOM_KEYS = ["KITCHEN", "BATHROOM", "BEDROOM", "LIVING", "LAUNDRY", "ELECTRONICS", "OTHER"] as const;
const STATUS_KEYS = ["TO_BUY", "BOUGHT", "GIFTED"] as const;
const PRIORITY_META: Record<string, { chip: string; weight: number }> = {
  ESSENTIAL: { chip: "bg-rose-500/15 text-rose-300", weight: 1 },
  NICE_TO_HAVE: { chip: "bg-amber-500/10 text-amber-300", weight: 2 },
  LUXURY: { chip: "bg-zinc-800 text-zinc-300", weight: 3 },
};
const PRIORITY_KEYS = ["ESSENTIAL", "NICE_TO_HAVE", "LUXURY"] as const;

const roomLabel = (t: TFn, k: string) => t(`room.${k}`);
const priorityLabel = (t: TFn, k: string) => t(`priority.${k}`);
const statusLabel = (t: TFn, k: string) => t(`status.${k}`);

type Item = {
  id: string;
  title: string;
  room: string;
  priority: string;
  status: string;
  estimatedPrice: number | null;
  actualPrice: number | null;
  store: string | null;
  link: string | null;
  notes: string | null;
};

export default function TrousseauClient({ items }: { items: Item[] }) {
  const t = useTranslations("dashboard.trousseau");
  const tc = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [filter, setFilter] = useState<"ALL" | "TO_BUY" | "BOUGHT" | "GIFTED">("ALL");
  const [busy, setBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const { pageItems, page, totalPages, total, from, to, setPage } = usePagination(filtered, 20);

  const totals = useMemo(() => {
    const estTotal = items.reduce((s, i) => s + (i.estimatedPrice ?? 0), 0);
    const actualTotal = items.reduce((s, i) => s + (i.actualPrice ?? 0), 0);
    const toBuy = items.filter((i) => i.status === "TO_BUY").length;
    const bought = items.filter((i) => i.status === "BOUGHT").length;
    const gifted = items.filter((i) => i.status === "GIFTED").length;
    return { estTotal, actualTotal, toBuy, bought, gifted };
  }, [items]);

  function handleCreate(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createTrousseauItem(undefined, formData);
        if (r.success) {
          toast.success(t("toast.created"));
          setOpen(false);
        } else toast.error(tc("common.errorGeneric"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }
  function handleUpdate(formData: FormData) {
    setUpdateBusy(true);
    startTransition(async () => {
      try {
        const r = await updateTrousseauItem(undefined, formData);
        if (r.success) {
          toast.success(t("toast.updated"));
          setEditing(null);
        } else toast.error(tc("common.errorGeneric"), r.error);
      } finally {
        setUpdateBusy(false);
      }
    });
  }
  function handleStatus(it: Item, status: "TO_BUY" | "BOUGHT" | "GIFTED") {
    startTransition(async () => {
      const r = await setTrousseauStatus(it.id, status);
      if (!r.success) toast.error(tc("common.errorGeneric"), r.error);
    });
  }
  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const r = await deleteTrousseauItem(id);
      if (r.success) {
        toast.success(t("toast.deleted"));
        setDeleting(null);
      } else toast.error(tc("common.errorGeneric"), r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat label={t("stats.estimated")} value={formatCurrency(totals.estTotal)} />
        <Stat label={t("stats.bought")} value={formatCurrency(totals.actualTotal)} accent="emerald" />
        <Stat label={t("stats.toBuy")} value={String(totals.toBuy)} accent="amber" />
        <Stat label={t("stats.gifted")} value={String(totals.gifted)} accent="emerald" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as typeof filter);
            setPage(1);
          }}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
        >
          <option value="ALL">{t("filter.all")}</option>
          <option value="TO_BUY">{t("status.TO_BUY")}</option>
          <option value="BOUGHT">{t("status.BOUGHT")}</option>
          <option value="GIFTED">{t("status.GIFTED")}</option>
        </select>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" /> {t("list.add")}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          {t("list.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {pageItems.map((it) => {
            const prioKey = PRIORITY_META[it.priority] ? it.priority : "NICE_TO_HAVE";
            const prio = PRIORITY_META[prioKey];
            return (
              <article
                key={it.id}
                className={`rounded-2xl border bg-zinc-900/50 p-4 ${
                  it.status === "BOUGHT" || it.status === "GIFTED" ? "border-zinc-800 opacity-80" : "border-zinc-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`font-medium ${it.status !== "TO_BUY" ? "text-zinc-400 line-through" : "text-zinc-100"}`}>
                        {it.title}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${prio.chip}`}>
                        {priorityLabel(t, prioKey)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {ROOM_KEYS.includes(it.room as (typeof ROOM_KEYS)[number]) ? roomLabel(t, it.room) : it.room}
                      {it.store ? ` · ${it.store}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-zinc-300">
                      {it.estimatedPrice ? formatCurrency(it.estimatedPrice) : "—"}
                      {it.actualPrice ? (
                        <span className="ml-2 text-emerald-300">
                          {t("card.paid", { value: formatCurrency(it.actualPrice) })}
                        </span>
                      ) : null}
                    </p>
                    {it.link ? (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200"
                      >
                        <ExternalLink className="h-3 w-3" /> {t("card.storeLink")}
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300">
                      {statusLabel(t, it.status)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleStatus(it, it.status === "BOUGHT" ? "TO_BUY" : "BOUGHT")}
                        aria-label={t("card.toggleBought")}
                        className={`rounded-lg p-1.5 ${
                          it.status === "BOUGHT"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700"
                        }`}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatus(it, it.status === "GIFTED" ? "TO_BUY" : "GIFTED")}
                        aria-label={t("card.toggleGifted")}
                        className={`rounded-lg p-1.5 ${
                          it.status === "GIFTED"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700"
                        }`}
                      >
                        <Gift className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(it)}
                        aria-label={tc("actions.edit")}
                        className="rounded-lg bg-zinc-800/70 p-1.5 text-zinc-300 hover:bg-zinc-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(it)}
                        aria-label={tc("actions.delete")}
                        className="rounded-lg bg-zinc-800/70 p-1.5 text-rose-400 hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        from={from}
        to={to}
        onPageChange={setPage}
      />

      {(open || editing) && (
        <ItemModal
          mode={editing ? "edit" : "create"}
          item={editing ?? undefined}
          isBusy={editing ? updateBusy : busy}
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

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber";
}) {
  const accentClass = accent === "emerald" ? "text-emerald-300" : accent === "amber" ? "text-amber-300" : "text-zinc-100";
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}

function ItemModal({
  mode,
  item,
  isBusy,
  onClose,
  formAction,
}: {
  mode: "create" | "edit";
  item?: Item;
  isBusy: boolean;
  onClose: () => void;
  formAction: (formData: FormData) => void;
}) {
  const t = useTranslations("dashboard.trousseau");
  const tc = useTranslations("common");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">
          {mode === "create" ? t("form.createTitle") : t("form.editTitle")}
        </h2>
        <form action={formAction} className="mt-4 space-y-3">
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <Field name="title" label={t("form.item")} required defaultValue={item?.title ?? ""} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.room")}</label>
              <select
                name="room"
                defaultValue={item?.room ?? "OTHER"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                {ROOM_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {roomLabel(t, k)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.priority")}</label>
              <select
                name="priority"
                defaultValue={item?.priority ?? "NICE_TO_HAVE"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                {PRIORITY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {priorityLabel(t, k)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field name="estimatedPrice" label={t("form.estimatedPrice")} type="number" step="0.01" defaultValue={item?.estimatedPrice?.toString() ?? ""} />
            <Field name="actualPrice" label={t("form.actualPrice")} type="number" step="0.01" defaultValue={item?.actualPrice?.toString() ?? ""} />
          </div>
          <Field name="store" label={t("form.store")} defaultValue={item?.store ?? ""} />
          <Field name="link" label={t("form.link")} type="url" defaultValue={item?.link ?? ""} />
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{tc("labels.status")}</label>
            <select
              name="status"
              defaultValue={item?.status ?? "TO_BUY"}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              {STATUS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {statusLabel(t, k)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.notes")}</label>
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={item?.notes ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
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


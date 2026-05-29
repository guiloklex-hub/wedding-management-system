"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  BedDouble,
  Briefcase,
  Compass,
  FileText,
  Loader2,
  Luggage,
  Pencil,
  Plane,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  createHoneymoonItem,
  deleteHoneymoonItem,
  updateHoneymoon,
  updateHoneymoonItem,
} from "@/app/actions/honeymoonActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency, formatDateBR, toIsoDate } from "@/lib/format";

type Item = {
  id: string;
  kind: string;
  title: string;
  vendor: string | null;
  startAt: Date | null;
  endAt: Date | null;
  amount: number | null;
  currency: string;
  status: string;
  confirmationNumber: string | null;
  notes: string | null;
};

type Honeymoon = {
  id: string;
  destination: string | null;
  startDate: Date | null;
  endDate: Date | null;
  budget: number | null;
  currency: string;
  notes: string | null;
  items: Item[];
};

const KIND_KEYS = ["FLIGHT", "HOTEL", "TRANSFER", "ACTIVITY", "DOCUMENT", "BAGGAGE", "OTHER"] as const;
const STATUS_KEYS = ["PLANNED", "BOOKED", "CONFIRMED", "PAID", "CANCELLED"] as const;

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  FLIGHT: Plane,
  HOTEL: BedDouble,
  TRANSFER: Compass,
  ACTIVITY: Compass,
  DOCUMENT: FileText,
  BAGGAGE: Luggage,
  OTHER: Briefcase,
};

export default function HoneymoonClient({ honeymoon }: { honeymoon: Honeymoon }) {
  const t = useTranslations("dashboard.honeymoon");
  const tc = useTranslations("common");
  const toast = useToast();
  const [editingInfo, setEditingInfo] = useState(false);
  const [busyInfo, setBusyInfo] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [busyItem, setBusyItem] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [, startTransition] = useTransition();

  const totals = useMemo(() => {
    const totalCost = honeymoon.items.reduce(
      (s, i) => s + (i.amount ?? 0),
      0,
    );
    const documentsPending = honeymoon.items.filter(
      (i) => i.kind === "DOCUMENT" && i.status !== "CONFIRMED" && i.status !== "PAID",
    ).length;
    return { totalCost, documentsPending };
  }, [honeymoon.items]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of honeymoon.items) {
      const arr = map.get(i.kind) ?? [];
      arr.push(i);
      map.set(i.kind, arr);
    }
    return map;
  }, [honeymoon.items]);

  function handleInfoSubmit(formData: FormData) {
    setBusyInfo(true);
    startTransition(async () => {
      try {
        const r = await updateHoneymoon(undefined, formData);
        if (r.success) {
          toast.success(t("toast.updated"));
          setEditingInfo(false);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusyInfo(false);
      }
    });
  }

  function handleCreate(formData: FormData) {
    setBusyItem(true);
    startTransition(async () => {
      try {
        const r = await createHoneymoonItem(undefined, formData);
        if (r.success) {
          toast.success(t("toast.itemAdded"));
          setOpen(false);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusyItem(false);
      }
    });
  }

  function handleUpdate(formData: FormData) {
    setUpdateBusy(true);
    startTransition(async () => {
      try {
        const r = await updateHoneymoonItem(undefined, formData);
        if (r.success) {
          toast.success(t("toast.itemUpdated"));
          setEditing(null);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setUpdateBusy(false);
      }
    });
  }

  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const r = await deleteHoneymoonItem(id);
      if (r.success) {
        toast.success(t("toast.itemRemoved"));
        setDeleting(null);
      } else toast.error(t("toast.failed"), r.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        {!editingInfo ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">{t("info.destination")}</p>
              <h2 className="mt-1 text-2xl font-bold text-white">{honeymoon.destination ?? t("info.notDecided")}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {honeymoon.startDate ? formatDateBR(honeymoon.startDate) : "—"}
                {" → "}
                {honeymoon.endDate ? formatDateBR(honeymoon.endDate) : "—"}
              </p>
              {honeymoon.notes ? (
                <p className="mt-3 whitespace-pre-line text-sm text-zinc-300">{honeymoon.notes}</p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t("info.budget")}</p>
                <p className="text-lg font-bold text-zinc-100">
                  {honeymoon.budget
                    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: honeymoon.currency }).format(honeymoon.budget)
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t("info.committed")}</p>
                <p className="text-lg font-bold text-rose-300">{formatCurrency(totals.totalCost)}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingInfo(true)}
                className="text-xs text-rose-300 hover:text-rose-200"
              >
                {t("info.editTrip")}
              </button>
            </div>
          </div>
        ) : (
          <form action={handleInfoSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field name="destination" label={t("info.destination")} defaultValue={honeymoon.destination ?? ""} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:col-span-2">
              <Field name="startDate" label={t("info.departure")} type="date" defaultValue={honeymoon.startDate ? toIsoDate(new Date(honeymoon.startDate)) : ""} />
              <Field name="endDate" label={t("info.return")} type="date" defaultValue={honeymoon.endDate ? toIsoDate(new Date(honeymoon.endDate)) : ""} />
            </div>
            <Field name="budget" label={t("info.budget")} type="number" step="0.01" defaultValue={honeymoon.budget?.toString() ?? ""} />
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{tc("labels.currency")}</label>
              <select
                name="currency"
                defaultValue={honeymoon.currency}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="BRL">{t("currency.brl")}</option>
                <option value="USD">{t("currency.usd")}</option>
                <option value="EUR">{t("currency.eur")}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-400">{tc("labels.notes")}</label>
              <textarea
                name="notes"
                rows={3}
                maxLength={2000}
                defaultValue={honeymoon.notes ?? ""}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setEditingInfo(false)}
                className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                {tc("actions.cancel")}
              </button>
              <button
                type="submit"
                disabled={busyInfo}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {busyInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {tc("actions.save")}
              </button>
            </div>
          </form>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" /> {t("actions.newItem")}
        </button>
      </div>

      {honeymoon.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          {t("list.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([kind, items]) => {
            const Icon = KIND_ICON[kind] ?? Briefcase;
            return (
              <section key={kind} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="mb-3 flex items-center gap-2 text-zinc-100">
                  <Icon className="h-5 w-5" />
                  <h3 className="font-semibold">{(KIND_KEYS as readonly string[]).includes(kind) ? t(`kind.${kind}`) : kind}</h3>
                  <span className="text-xs text-zinc-500">({items.length})</span>
                </div>
                <ul className="space-y-2">
                  {items.map((it) => (
                    <li
                      key={it.id}
                      className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-100">{it.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                          {it.vendor ? <span>{it.vendor}</span> : null}
                          {it.startAt ? <span>📅 {formatDateBR(it.startAt)}</span> : null}
                          {it.confirmationNumber ? <span>#{it.confirmationNumber}</span> : null}
                          <span>{(STATUS_KEYS as readonly string[]).includes(it.status) ? t(`status.${it.status}`) : it.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {it.amount ? (
                          <span className="font-semibold text-zinc-200">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: it.currency,
                            }).format(it.amount)}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEditing(it)}
                          aria-label={tc("actions.edit")}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(it)}
                          aria-label={tc("actions.delete")}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {(open || editing) && (
        <ItemModal
          mode={editing ? "edit" : "create"}
          item={editing ?? undefined}
          isBusy={editing ? updateBusy : busyItem}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          formAction={editing ? handleUpdate : handleCreate}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t("delete.confirmTitle")}
        confirmLabel={tc("actions.delete")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
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
  const t = useTranslations("dashboard.honeymoon");
  const tc = useTranslations("common");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">
          {mode === "create" ? t("form.titleCreate") : t("form.titleEdit")}
        </h2>
        <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.kind")}</label>
            <select
              name="kind"
              defaultValue={item?.kind ?? "ACTIVITY"}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              {KIND_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(`kind.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <Field name="title" label={t("form.title")} required defaultValue={item?.title ?? ""} />
          <Field name="vendor" label={t("form.vendor")} defaultValue={item?.vendor ?? ""} />
          <Field name="startAt" label={t("form.start")} type="date" defaultValue={item?.startAt ? toIsoDate(new Date(item.startAt)) : ""} />
          <Field name="endAt" label={t("form.end")} type="date" defaultValue={item?.endAt ? toIsoDate(new Date(item.endAt)) : ""} />
          <Field name="amount" label={t("form.amount")} type="number" step="0.01" defaultValue={item?.amount?.toString() ?? ""} />
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{tc("labels.currency")}</label>
            <select
              name="currency"
              defaultValue={item?.currency ?? "BRL"}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <Field name="confirmationNumber" label={t("form.confirmationNumber")} defaultValue={item?.confirmationNumber ?? ""} />
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{tc("labels.status")}</label>
            <select
              name="status"
              defaultValue={item?.status ?? "PLANNED"}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              {STATUS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(`status.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-400">{tc("labels.notes")}</label>
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={item?.notes ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            />
          </div>
          <div className="flex gap-2 pt-2 sm:col-span-2">
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

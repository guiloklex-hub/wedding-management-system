"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Gift as GiftIcon, Heart, Landmark, Loader2, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import {
  convertGiftCashToIncomeOrAsset,
  createGift,
  deleteGift,
  markGiftThanked,
  updateGift,
} from "@/app/actions/giftActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination, usePagination } from "@/components/pagination";
import { formatCurrency, formatDateBR, toIsoDate } from "@/lib/format";

type GiftRow = {
  id: string;
  guestId: string | null;
  giverName: string | null;
  type: string;
  amount: number | null;
  description: string | null;
  status: string;
  receivedAt: Date;
  thankedAt: Date | null;
  isHoneymoonShare: boolean;
  pixPaidAt: Date | null;
  processedAt: Date | null;
  notes: string | null;
  guest: { id: string; name: string } | null;
};

type GuestRef = { id: string; name: string };

export default function GiftsClient({ gifts, guests }: { gifts: GiftRow[]; guests: GuestRef[] }) {
  const t = useTranslations("dashboard.gifts");
  const tc = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GiftRow | null>(null);
  const [deleting, setDeleting] = useState<GiftRow | null>(null);
  const [converting, setConverting] = useState<GiftRow | null>(null);
  const [convertBusy, setConvertBusy] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "PENDING_THANK">("ALL");
  const [busy, setBusy] = useState(false);
  const [updatingBusy, setUpdatingBusy] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (filter === "PENDING_THANK") return gifts.filter((g) => g.status !== "THANKED");
    return gifts;
  }, [gifts, filter]);

  const { pageItems, page, totalPages, total, from, to, setPage } = usePagination(filtered, 20);

  const totals = useMemo(() => {
    const cashGifts = gifts.filter((g) => g.type === "CASH");
    const cash = cashGifts.reduce((s, g) => s + (g.amount ?? 0), 0);
    const cashPending = cashGifts
      .filter((g) => !g.processedAt && (g.amount ?? 0) > 0)
      .reduce((s, g) => s + (g.amount ?? 0), 0);
    const items = gifts.filter((g) => g.type === "ITEM").length;
    const pending = gifts.filter((g) => g.status !== "THANKED").length;
    return { cash, cashPending, items, pending };
  }, [gifts]);

  function handleCreate(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createGift(undefined, formData);
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
        const r = await updateGift(undefined, formData);
        if (r.success) {
          toast.success(t("toast.updated"));
          setEditing(null);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setUpdatingBusy(false);
      }
    });
  }
  function handleThanked(g: GiftRow) {
    startTransition(async () => {
      const r = await markGiftThanked(g.id, g.status !== "THANKED");
      if (r.success) toast.success(g.status === "THANKED" ? t("toast.unthanked") : t("toast.thanked"));
      else toast.error(t("toast.failed"), r.error);
    });
  }
  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const r = await deleteGift(id);
      if (r.success) {
        toast.success(t("toast.removed"));
        setDeleting(null);
      } else toast.error(t("toast.failed"), r.error);
    });
  }
  function handleConvert(input: { giftId: string; recordType: "INCOME" | "ASSET"; title: string; date: string }) {
    setConvertBusy(true);
    startTransition(async () => {
      try {
        const r = await convertGiftCashToIncomeOrAsset(input);
        if (r.success) {
          toast.success(t("toast.converted"));
          setConverting(null);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setConvertBusy(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.cashTotal")} value={formatCurrency(totals.cash)} accent="emerald" />
        <StatCard label={t("stats.cashPending")} value={formatCurrency(totals.cashPending)} accent="amber" />
        <StatCard label={t("stats.itemsReceived")} value={String(totals.items)} />
        <StatCard label={t("stats.pendingThank")} value={String(totals.pending)} accent="amber" />
      </div>

      <div className="flex items-center justify-between">
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as typeof filter);
            setPage(1);
          }}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
        >
          <option value="ALL">{t("filter.all")}</option>
          <option value="PENDING_THANK">{t("filter.pendingThank")}</option>
        </select>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" /> {t("actions.new")}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          {t("list.empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {pageItems.map((g) => (
            <li key={g.id} className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:flex-row sm:items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                <GiftIcon className={`h-4 w-4 ${g.type === "CASH" ? "text-emerald-400" : "text-sky-400"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-100">
                    {g.guest?.name ?? g.giverName ?? t("anonymous")}
                  </span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                    {g.type === "CASH" ? t("type.cash") : t("type.item")}
                  </span>
                  {g.status === "THANKED" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> {t("badge.thanked")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDateBR(g.receivedAt)}
                  {g.description ? ` · ${g.description}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {g.type === "CASH" && g.amount ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-lg font-semibold text-emerald-300">{formatCurrency(g.amount)}</span>
                    <div className="flex items-center gap-1">
                      {g.isHoneymoonShare ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                          <Heart className="h-2.5 w-2.5" /> {t("badge.honeymoon")}
                        </span>
                      ) : null}
                      {g.pixPaidAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          {t("badge.pixReceived")}
                        </span>
                      ) : null}
                      {g.processedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">
                          <Landmark className="h-2.5 w-2.5" /> {t("badge.processed")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center gap-1">
                  {g.type === "CASH" && (g.amount ?? 0) > 0 && !g.processedAt ? (
                    <button
                      type="button"
                      onClick={() => setConverting(g)}
                      aria-label={t("actions.convert")}
                      title={t("actions.convert")}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-sky-500/10 hover:text-sky-300"
                    >
                      <Landmark className="h-4 w-4" />
                    </button>
                  ) : null}
                  {g.type === "CASH" ? (
                    <Link
                      href={`/dashboard/gifts/${g.id}/pix`}
                      aria-label={t("actions.generatePix")}
                      title={t("actions.generatePix")}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <QrCode className="h-4 w-4" />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleThanked(g)}
                    className={`rounded-lg p-1.5 ${
                      g.status === "THANKED"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700"
                    }`}
                    aria-label={t("actions.toggleThank")}
                    title={g.status === "THANKED" ? t("actions.unmarkThanked") : t("actions.markThanked")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(g)}
                    aria-label={tc("actions.edit")}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(g)}
                    aria-label={tc("actions.delete")}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
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
        <GiftFormModal
          mode={editing ? "edit" : "create"}
          gift={editing ?? undefined}
          guests={guests}
          isBusy={editing ? updatingBusy : busy}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          formAction={editing ? handleUpdate : handleCreate}
        />
      )}

      {converting ? (
        <ConvertModal
          gift={converting}
          isBusy={convertBusy}
          onClose={() => setConverting(null)}
          onConvert={handleConvert}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        title={t("delete.title")}
        confirmLabel={tc("actions.delete")}
        cancelLabel={tc("actions.cancel")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function ConvertModal({
  gift,
  isBusy,
  onClose,
  onConvert,
}: {
  gift: GiftRow;
  isBusy: boolean;
  onClose: () => void;
  onConvert: (input: { giftId: string; recordType: "INCOME" | "ASSET"; title: string; date: string }) => void;
}) {
  const t = useTranslations("dashboard.gifts");
  const tc = useTranslations("common");
  const giver = gift.guest?.name ?? gift.giverName ?? t("convert.guestFallback");
  const [recordType, setRecordType] = useState<"INCOME" | "ASSET">("INCOME");
  const [title, setTitle] = useState(t("convert.defaultTitle", { giver }));
  const [date, setDate] = useState(toIsoDate(new Date(gift.receivedAt)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onConvert({ giftId: gift.id, recordType, title: title.trim(), date });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">{t("convert.title")}</h2>
        <p className="mt-1 text-xs text-zinc-400">{t("convert.intro")}</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
            <span className="text-xs uppercase tracking-wide text-zinc-500">{t("convert.amountLabel")}</span>
            <span className="text-base font-semibold text-emerald-300">{formatCurrency(gift.amount ?? 0)}</span>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("convert.recordType")}</label>
            <select
              value={recordType}
              onChange={(e) => setRecordType(e.target.value as "INCOME" | "ASSET")}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="INCOME">{t("convert.asIncome")}</option>
              <option value="ASSET">{t("convert.asAsset")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("convert.titleField")}</label>
            <input
              type="text"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("convert.dateField")}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
              disabled={isBusy || title.trim().length === 0}
              className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("convert.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatCard({
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
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}

function GiftFormModal({
  mode,
  gift,
  guests,
  isBusy,
  onClose,
  formAction,
}: {
  mode: "create" | "edit";
  gift?: GiftRow;
  guests: GuestRef[];
  isBusy: boolean;
  onClose: () => void;
  formAction: (formData: FormData) => void;
}) {
  const t = useTranslations("dashboard.gifts");
  const tc = useTranslations("common");
  const [type, setType] = useState(gift?.type ?? "CASH");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">
          {mode === "create" ? t("form.titleCreate") : t("form.titleEdit")}
        </h2>
        <form action={formAction} className="mt-4 space-y-3">
          {gift ? <input type="hidden" name="id" value={gift.id} /> : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.type")}</label>
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="CASH">{t("type.cash")}</option>
              <option value="ITEM">{t("type.item")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.guest")}</label>
            <select
              name="guestId"
              defaultValue={gift?.guestId ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="">—</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <Field name="giverName" label={t("form.giverName")} defaultValue={gift?.giverName ?? ""} />
          {type === "CASH" ? (
            <Field name="amount" label={t("form.amount")} type="number" step="0.01" defaultValue={gift?.amount?.toString() ?? ""} />
          ) : (
            <Field
              name="description"
              label={t("form.description")}
              defaultValue={gift?.description ?? ""}
            />
          )}
          <Field
            name="receivedAt"
            label={t("form.receivedAt")}
            type="date"
            defaultValue={gift ? toIsoDate(new Date(gift.receivedAt)) : toIsoDate(new Date())}
          />
          {type === "CASH" ? (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                name="isHoneymoonShare"
                defaultChecked={gift?.isHoneymoonShare ?? false}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-800"
              />
              {t("form.honeymoonShare")}
            </label>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.notes")}</label>
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={gift?.notes ?? ""}
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
  step,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  step?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <input
        type={type}
        name={name}
        step={step}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

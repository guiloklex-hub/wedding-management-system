"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { createVenue, deleteVenue } from "@/app/actions/venueActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency, formatDateBR } from "@/lib/format";

type VenueRow = {
  id: string;
  name: string;
  address: string | null;
  capacitySeated: number | null;
  capacityStanding: number | null;
  baseRate: number | null;
  visitedAt: Date | null;
  isShortlisted: boolean;
  attachmentCount: number;
  checklistTotal: number;
  checklistDone: number;
};

export default function VenuesClient({ venues }: { venues: VenueRow[] }) {
  const t = useTranslations("dashboard.venues");
  const tc = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<VenueRow | null>(null);
  const [, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createVenue(undefined, formData);
        if (r.success) {
          toast.success(t("toast.created"));
          setOpen(false);
        } else toast.error(t("toast.fail"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const r = await deleteVenue(target.id);
      if (r.success) {
        toast.success(t("toast.removed"));
        setDeleting(null);
      } else toast.error(t("toast.fail"), r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" />
          <span>{t("list.new")}</span>
        </button>
      </div>

      {venues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          {t("list.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {venues.map((v) => (
            <article key={v.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/venues/${v.id}`}
                    className="text-lg font-semibold text-zinc-100 hover:text-rose-300"
                  >
                    {v.name}
                  </Link>
                  {v.address ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                      <MapPin className="h-3 w-3" /> {v.address}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {v.isShortlisted ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {t("list.favorite")}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDeleting(v)}
                    aria-label={t("list.deleteAria")}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <Mini label={t("fields.seated")}>{v.capacitySeated ?? "—"}</Mini>
                <Mini label={t("fields.standing")}>{v.capacityStanding ?? "—"}</Mini>
                <Mini label={t("fields.rate")}>{v.baseRate ? formatCurrency(v.baseRate) : "—"}</Mini>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>{t("list.checklistCount", { done: v.checklistDone, total: v.checklistTotal })}</span>
                <span>{t("list.attachments", { count: v.attachmentCount })}</span>
                {v.visitedAt ? (
                  <span>{t("list.visitedOn", { date: formatDateBR(v.visitedAt) })}</span>
                ) : (
                  <span>{t("list.noVisit")}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="my-4 w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">{t("list.new")}</h2>
            <form action={handleSubmit} className="mt-4 space-y-3">
              <Input name="name" label={t("fields.name")} required placeholder={t("form.namePlaceholder")} />
              <Input name="address" label={t("fields.address")} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input name="mapsUrl" label={t("fields.mapsUrl")} type="url" />
                <Input name="baseRate" label={t("fields.baseRate")} type="number" step="0.01" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input name="capacitySeated" label={t("fields.capacitySeated")} type="number" />
                <Input name="capacityStanding" label={t("fields.capacityStanding")} type="number" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input name="contactName" label={t("fields.contactName")} />
                <Input name="contactPhone" label={t("fields.contactPhone")} />
              </div>
              <Input name="visitedAt" label={t("fields.visitedAt")} type="date" />
              <Textarea name="pros" label={t("fields.pros")} rows={2} />
              <Textarea name="cons" label={t("fields.cons")} rows={2} />
              <Textarea name="restrictions" label={t("fields.restrictions")} rows={2} />
              <Textarea name="pricingNotes" label={t("fields.pricingNotes")} rows={2} />
              <Textarea name="notes" label={t("fields.notes")} rows={2} />
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" name="isShortlisted" className="accent-rose-500" />
                {t("form.markFavorite")}
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" name="seedChecklist" defaultChecked className="accent-rose-500" />
                {t("form.seedChecklist")}
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-zinc-800 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  {tc("actions.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("actions.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        title={deleting ? t("delete.confirmTitle", { name: deleting.name }) : t("delete.confirmTitleFallback")}
        description={t("delete.confirmDescription")}
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

function Input({
  name,
  label,
  type = "text",
  required,
  placeholder,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        step={step}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

function Textarea({ name, label, rows = 3 }: { name: string; label: string; rows?: number }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <textarea
        name={name}
        rows={rows}
        maxLength={2000}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

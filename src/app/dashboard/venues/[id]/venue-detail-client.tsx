"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Paperclip,
  Phone,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  addChecklistItem,
  deleteChecklistItem,
  deleteVenue,
  toggleChecklistItem,
  updateVenue,
} from "@/app/actions/venueActions";
import { deleteAttachment, uploadAttachment } from "@/app/actions/attachmentActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency, formatDateBR, toIsoDate } from "@/lib/format";

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  value: string | null;
  sortOrder: number;
};

type Attachment = {
  id: string;
  kind: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date | string;
};

type VenueFull = {
  id: string;
  name: string;
  address: string | null;
  mapsUrl: string | null;
  capacitySeated: number | null;
  capacityStanding: number | null;
  baseRate: number | null;
  pricingNotes: string | null;
  restrictions: string | null;
  pros: string | null;
  cons: string | null;
  isShortlisted: boolean;
  visitedAt: Date | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  checklistItems: ChecklistItem[];
  attachments: Attachment[];
};

export default function VenueDetailClient({ venue }: { venue: VenueFull }) {
  const t = useTranslations("dashboard.venues");
  const tc = useTranslations("common");
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [, startTransition] = useTransition();

  function handleUpdate(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await updateVenue(undefined, formData);
        if (r.success) {
          toast.success(t("toast.updated"));
          setEditing(false);
        } else toast.error(t("toast.fail"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const r = await deleteVenue(venue.id);
      if (r.success) {
        toast.success(t("toast.removed"));
        window.location.href = "/dashboard/venues";
      } else toast.error(t("toast.fail"), r.error);
    });
  }

  const checklistDone = venue.checklistItems.filter((i) => i.checked).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{venue.name}</h1>
              {venue.isShortlisted ? (
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              ) : null}
            </div>
            {venue.address ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-zinc-400">
                <MapPin className="h-3.5 w-3.5" /> {venue.address}
              </p>
            ) : null}
            {venue.contactName || venue.contactPhone ? (
              <p className="mt-1 text-sm text-zinc-400">
                {t("detail.contactLabel")} {venue.contactName ?? "—"}
                {venue.contactPhone ? (
                  <>
                    {" · "}
                    <a
                      href={`https://wa.me/${venue.contactPhone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <Phone className="h-3 w-3" /> {venue.contactPhone}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            {venue.mapsUrl ? (
              <a
                href={venue.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {t("detail.openMaps")}
              </a>
            ) : null}
          </div>
          <div className="flex flex-col items-stretch gap-2 md:items-end">
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="rounded-xl bg-zinc-800 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              {editing ? t("detail.closeEdit") : tc("actions.edit")}
            </button>
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/20"
            >
              {t("detail.deleteVenue")}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label={t("fields.seated")}>{venue.capacitySeated ?? "—"}</Stat>
          <Stat label={t("fields.standing")}>{venue.capacityStanding ?? "—"}</Stat>
          <Stat label={t("fields.rate")}>{venue.baseRate ? formatCurrency(venue.baseRate) : "—"}</Stat>
        </div>

        {venue.visitedAt ? (
          <p className="mt-4 text-xs text-zinc-500">
            {t("list.visitedOn", { date: formatDateBR(venue.visitedAt) })}
          </p>
        ) : null}
      </div>

      {editing ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">{t("editForm.title")}</h2>
          <form action={handleUpdate} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={venue.id} />
            <Input name="name" label={t("fields.name")} defaultValue={venue.name} required />
            <Input name="address" label={t("fields.address")} defaultValue={venue.address ?? ""} />
            <Input name="mapsUrl" label={t("editForm.mapsUrl")} defaultValue={venue.mapsUrl ?? ""} />
            <Input
              name="baseRate"
              label={t("editForm.baseRate")}
              type="number"
              step="0.01"
              defaultValue={venue.baseRate?.toString() ?? ""}
            />
            <Input
              name="capacitySeated"
              label={t("fields.seated")}
              type="number"
              defaultValue={venue.capacitySeated?.toString() ?? ""}
            />
            <Input
              name="capacityStanding"
              label={t("fields.standing")}
              type="number"
              defaultValue={venue.capacityStanding?.toString() ?? ""}
            />
            <Input name="contactName" label={t("editForm.contactName")} defaultValue={venue.contactName ?? ""} />
            <Input name="contactPhone" label={t("editForm.contactPhone")} defaultValue={venue.contactPhone ?? ""} />
            <Input
              name="visitedAt"
              label={t("editForm.visitedAt")}
              type="date"
              defaultValue={venue.visitedAt ? toIsoDate(new Date(venue.visitedAt)) : ""}
            />
            <div className="flex items-center gap-2 self-end">
              <input
                type="checkbox"
                name="isShortlisted"
                defaultChecked={venue.isShortlisted}
                className="accent-rose-500"
              />
              <label className="text-sm text-zinc-300">{t("editForm.favorite")}</label>
            </div>
            <Textarea name="pros" label={t("fields.pros")} defaultValue={venue.pros ?? ""} className="sm:col-span-2" />
            <Textarea name="cons" label={t("fields.cons")} defaultValue={venue.cons ?? ""} className="sm:col-span-2" />
            <Textarea
              name="restrictions"
              label={t("fields.restrictions")}
              defaultValue={venue.restrictions ?? ""}
              className="sm:col-span-2"
            />
            <Textarea
              name="pricingNotes"
              label={t("editForm.pricingNotes")}
              defaultValue={venue.pricingNotes ?? ""}
              className="sm:col-span-2"
            />
            <Textarea
              name="notes"
              label={t("fields.notes")}
              defaultValue={venue.notes ?? ""}
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {tc("actions.save")}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ProsConsBlock title={t("fields.pros")} body={venue.pros} accent="emerald" />
          <ProsConsBlock title={t("fields.cons")} body={venue.cons} accent="rose" />
          {venue.restrictions ? (
            <NotesCard title={t("fields.restrictions")} body={venue.restrictions} />
          ) : null}
          {venue.pricingNotes ? (
            <NotesCard title={t("fields.pricingNotes")} body={venue.pricingNotes} />
          ) : null}
          {venue.notes ? <NotesCard title={t("fields.notes")} body={venue.notes} /> : null}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">{t("checklist.title")}</h3>
            <p className="text-xs text-zinc-500">
              {t("checklist.answered", { done: checklistDone, total: venue.checklistItems.length })}
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {venue.checklistItems.map((item) => (
            <ChecklistRow key={item.id} item={item} startTransition={startTransition} toast={toast} />
          ))}
        </ul>
        <AddChecklistForm venueId={venue.id} startTransition={startTransition} toast={toast} />
      </div>

      <AttachmentsCard venue={venue} startTransition={startTransition} toast={toast} />

      <ConfirmDialog
        open={deleting}
        title={t("delete.confirmTitle", { name: venue.name })}
        description={t("delete.confirmDescriptionDetail")}
        confirmLabel={tc("actions.delete")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

function ChecklistRow({
  item,
  startTransition,
  toast,
}: {
  item: ChecklistItem;
  startTransition: React.TransitionStartFunction;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.venues");
  const [value, setValue] = useState(item.value ?? "");
  const [checked, setChecked] = useState(item.checked);

  function persist(nextChecked: boolean, nextValue: string) {
    startTransition(async () => {
      const r = await toggleChecklistItem(item.id, nextChecked, nextValue);
      if (!r.success) toast.error(t("toast.fail"), r.error);
    });
  }

  function onCheck(next: boolean) {
    setChecked(next);
    persist(next, value);
  }
  function onBlurValue() {
    persist(checked, value);
  }
  function onDelete() {
    startTransition(async () => {
      const r = await deleteChecklistItem(item.id);
      if (!r.success) toast.error(t("toast.fail"), r.error);
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => onCheck(!checked)}
        className="flex flex-1 items-start gap-3 text-left"
      >
        {checked ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        ) : (
          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-600" />
        )}
        <span className={`text-sm ${checked ? "text-zinc-400 line-through" : "text-zinc-200"}`}>
          {item.label}
        </span>
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlurValue}
        placeholder={t("checklist.answerPlaceholder")}
        className="sm:w-64 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
      <button
        type="button"
        onClick={onDelete}
        aria-label={t("checklist.deleteItemAria")}
        className="self-end rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 sm:self-auto"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function AddChecklistForm({
  venueId,
  startTransition,
  toast,
}: {
  venueId: string;
  startTransition: React.TransitionStartFunction;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.venues");
  const tc = useTranslations("common");
  const [busy, setBusy] = useState(false);

  function handleSubmit(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await addChecklistItem(undefined, formData);
        if (r.success) {
          const form = document.getElementById(`checklist-add-${venueId}`) as HTMLFormElement | null;
          form?.reset();
        } else toast.error(t("toast.fail"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <form id={`checklist-add-${venueId}`} action={handleSubmit} className="mt-4 flex gap-2">
      <input type="hidden" name="venueId" value={venueId} />
      <input
        type="text"
        name="label"
        required
        maxLength={200}
        placeholder={t("checklist.addPlaceholder")}
        className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        <span>{tc("actions.add")}</span>
      </button>
    </form>
  );
}

function AttachmentsCard({
  venue,
  startTransition,
  toast,
}: {
  venue: VenueFull;
  startTransition: React.TransitionStartFunction;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.venues");
  const tcCommon = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleUpload(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await uploadAttachment(undefined, formData);
        if (r.success) {
          const form = document.getElementById(`venue-upload-${venue.id}`) as HTMLFormElement | null;
          form?.reset();
        } else toast.error(t("toast.fail"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    startTransition(async () => {
      const r = await deleteAttachment(id);
      if (r.success) {
        toast.success(t("attachments.removed"));
        setDeleteId(null);
      } else toast.error(t("toast.fail"), r.error);
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-center gap-2 text-zinc-100">
        <Paperclip className="h-5 w-5" />
        <h3 className="text-lg font-semibold">{t("attachments.title")}</h3>
      </div>
      <form
        id={`venue-upload-${venue.id}`}
        action={handleUpload}
        className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      >
        <input type="hidden" name="ownerType" value="VENUE" />
        <input type="hidden" name="ownerId" value={venue.id} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-400">{t("attachments.file")}</span>
          <input
            type="file"
            name="file"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1 file:text-zinc-100"
          />
        </label>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">{t("attachments.kind")}</label>
          <select
            name="kind"
            defaultValue="PHOTO"
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
          >
            <option value="PHOTO">{t("attachments.kinds.PHOTO")}</option>
            <option value="CONTRACT">{t("attachments.kinds.CONTRACT")}</option>
            <option value="PROPOSAL">{t("attachments.kinds.PROPOSAL")}</option>
            <option value="OTHER">{t("attachments.kinds.OTHER")}</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{t("attachments.upload")}</span>
        </button>
      </form>

      {venue.attachments.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("attachments.empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {venue.attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
                {a.mimeType.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 text-sky-400" />
                ) : (
                  <FileText className="h-4 w-4 text-rose-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/api/files/${a.id}`}
                  target="_blank"
                  className="block truncate text-sm font-medium text-zinc-200 hover:text-rose-300"
                >
                  {a.filename}
                </Link>
                <p className="text-[11px] text-zinc-500">
                  {attachmentKindLabel(t, a.kind)} · {(a.size / 1024).toFixed(1)} KB · {formatDateBR(a.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteId(a.id)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                aria-label={t("attachments.deleteAria")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title={t("attachments.deleteTitle")}
        confirmLabel={tcCommon("actions.delete")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function attachmentKindLabel(t: ReturnType<typeof useTranslations>, kind: string): string {
  const known = ["PHOTO", "CONTRACT", "PROPOSAL", "OTHER"];
  return known.includes(kind) ? t(`attachments.kinds.${kind}`) : kind;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-200">{children}</p>
    </div>
  );
}

function ProsConsBlock({
  title,
  body,
  accent,
}: {
  title: string;
  body: string | null;
  accent: "emerald" | "rose";
}) {
  if (!body) return null;
  const accentClass =
    accent === "emerald" ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5";
  return (
    <div className={`rounded-2xl border p-5 ${accentClass}`}>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-300">{title}</h3>
      <p className="whitespace-pre-line text-sm text-zinc-200">{body}</p>
    </div>
  );
}

function NotesCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-300">{title}</h3>
      <p className="whitespace-pre-line text-sm text-zinc-200">{body}</p>
    </div>
  );
}

function Input({
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

function Textarea({
  name,
  label,
  rows = 3,
  defaultValue,
  className,
}: {
  name: string;
  label: string;
  rows?: number;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        maxLength={2000}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

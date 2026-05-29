"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  createGuest,
  deleteGuest,
  toggleCheckin,
  updateGuest,
} from "@/app/actions/guestActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination, usePagination } from "@/components/pagination";

type Guest = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  side: string | null;
  groupName: string | null;
  rsvpStatus: string;
  rsvpToken: string;
  rsvpRespondedAt: Date | null;
  plusOnesAllowed: number;
  plusOnesConfirmed: number;
  isChild: boolean;
  isVIP: boolean;
  isPadrinho: boolean;
  dietary: string | null;
  tableNumber: string | null;
  city: string | null;
  checkedInAt: Date | null;
  notes: string | null;
};

const RSVP_KEY: Record<string, string> = {
  NOT_INVITED: "rsvp.notInvited",
  INVITED: "rsvp.invited",
  CONFIRMED: "rsvp.confirmed",
  DECLINED: "rsvp.declined",
  MAYBE: "rsvp.maybe",
};

const RSVP_CHIP: Record<string, string> = {
  NOT_INVITED: "bg-zinc-800 text-zinc-400 border-zinc-700",
  INVITED: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  CONFIRMED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  DECLINED: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  MAYBE: "bg-sky-500/10 text-sky-300 border-sky-500/20",
};

export default function GuestsClient({ guests, baseUrl }: { guests: Guest[]; baseUrl: string }) {
  const t = useTranslations("dashboard.guests");
  const tc = useTranslations("common");
  const rsvpLabel = (status: string) =>
    RSVP_KEY[status] ? t(RSVP_KEY[status]) : status;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [deleting, setDeleting] = useState<Guest | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "CONFIRMED" | "PENDING" | "PADRINHOS" | "CHILDREN" | "CHECKED_IN">("ALL");
  const [busy, setBusy] = useState(false);
  const [updatingBusy, setUpdatingBusy] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (filter === "CONFIRMED" && g.rsvpStatus !== "CONFIRMED") return false;
      if (filter === "PENDING" && g.rsvpStatus !== "INVITED" && g.rsvpStatus !== "MAYBE") return false;
      if (filter === "PADRINHOS" && !g.isPadrinho) return false;
      if (filter === "CHILDREN" && !g.isChild) return false;
      if (filter === "CHECKED_IN" && !g.checkedInAt) return false;
      if (term && !`${g.name} ${g.email ?? ""} ${g.groupName ?? ""}`.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [guests, search, filter]);

  const { pageItems, page, totalPages, total, from, to, setPage } = usePagination(filtered, 20);

  const stats = useMemo(() => {
    const total = guests.length;
    const confirmed = guests.filter((g) => g.rsvpStatus === "CONFIRMED").length;
    const declined = guests.filter((g) => g.rsvpStatus === "DECLINED").length;
    const pending = guests.filter((g) => g.rsvpStatus === "INVITED" || g.rsvpStatus === "MAYBE").length;
    const seats =
      guests
        .filter((g) => g.rsvpStatus === "CONFIRMED")
        .reduce((s, g) => s + 1 + g.plusOnesConfirmed, 0);
    const children = guests.filter((g) => g.rsvpStatus === "CONFIRMED" && g.isChild).length;
    const dietary = guests.filter((g) => g.rsvpStatus === "CONFIRMED" && g.dietary).length;
    return { total, confirmed, declined, pending, seats, children, dietary };
  }, [guests]);

  function handleCreate(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createGuest(undefined, formData);
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
    setUpdatingBusy(true);
    startTransition(async () => {
      try {
        const r = await updateGuest(undefined, formData);
        if (r.success) {
          toast.success(t("toast.updated"));
          setEditing(null);
        } else toast.error(tc("common.errorGeneric"), r.error);
      } finally {
        setUpdatingBusy(false);
      }
    });
  }
  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const r = await deleteGuest(id);
      if (r.success) {
        toast.success(t("toast.removed"));
        setDeleting(null);
      } else toast.error(tc("common.errorGeneric"), r.error);
    });
  }
  function handleCheckin(guest: Guest) {
    startTransition(async () => {
      const r = await toggleCheckin(guest.id, !guest.checkedInAt);
      if (r.success) toast.success(guest.checkedInAt ? t("toast.checkinReverted") : t("toast.checkinDone"));
      else toast.error(tc("common.errorGeneric"), r.error);
    });
  }
  function copyRsvp(guest: Guest) {
    const url = `${baseUrl}/rsvp/${guest.rsvpToken}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(t("toast.linkCopied")),
      () => toast.error(t("toast.copyFailed")),
    );
  }

  function exportCsv() {
    const header = [
      t("csv.name"),
      t("csv.phone"),
      t("csv.email"),
      t("csv.side"),
      t("csv.group"),
      t("csv.status"),
      t("csv.plusOnesConfirmed"),
      t("csv.table"),
      t("csv.dietary"),
      t("csv.city"),
      t("csv.padrinho"),
      t("csv.vip"),
      t("csv.child"),
    ].join(",");
    const rows = filtered.map((g) =>
      [
        g.name,
        g.phone ?? "",
        g.email ?? "",
        g.side ?? "",
        g.groupName ?? "",
        rsvpLabel(g.rsvpStatus),
        g.plusOnesConfirmed,
        g.tableNumber ?? "",
        g.dietary ?? "",
        g.city ?? "",
        g.isPadrinho ? t("csv.yes") : "",
        g.isVIP ? t("csv.yes") : "",
        g.isChild ? t("csv.yes") : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([`${header}\n${rows.join("\n")}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("csv.fileName")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("stats.list")} value={stats.total} sub={t("stats.guests")} />
        <StatTile
          label={t("stats.confirmed")}
          value={stats.confirmed}
          sub={t("stats.heads", { count: stats.seats })}
          accent="emerald"
        />
        <StatTile label={t("stats.pending")} value={stats.pending} accent="amber" />
        <StatTile label={t("stats.declined")} value={stats.declined} accent="rose" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("filters.searchPlaceholder")}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setPage(1);
            }}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
          >
            <option value="ALL">{t("filters.all")}</option>
            <option value="CONFIRMED">{t("filters.confirmed")}</option>
            <option value="PENDING">{t("filters.pending")}</option>
            <option value="PADRINHOS">{t("filters.padrinhos")}</option>
            <option value="CHILDREN">{t("filters.children")}</option>
            <option value="CHECKED_IN">{t("filters.checkedIn")}</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/guests/groups"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
          >
            <Users className="h-4 w-4" /> {t("actions.groups")}
          </Link>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
          >
            <Download className="h-4 w-4" /> {t("actions.csv")}
          </button>
          <Link
            href="/dashboard/guests/import"
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20"
          >
            <Upload className="h-4 w-4" /> {t("actions.importList")}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-rose-500"
          >
            <Plus className="h-4 w-4" /> {t("actions.newGuest")}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("table.name")}</th>
                <th className="px-4 py-3 font-medium">{t("table.group")}</th>
                <th className="px-4 py-3 font-medium">{t("table.rsvp")}</th>
                <th className="px-4 py-3 font-medium">{t("table.plusOne")}</th>
                <th className="px-4 py-3 font-medium">{t("table.table")}</th>
                <th className="px-4 py-3 font-medium">{t("table.attendance")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    {guests.length === 0 ? t("table.empty") : t("table.noResults")}
                  </td>
                </tr>
              ) : (
                pageItems.map((g) => (
                  <tr key={g.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1 font-medium text-zinc-200">
                        <span>{g.name}</span>
                        {g.isPadrinho ? <Tag>{t("tags.padrinhoShort")}</Tag> : null}
                        {g.isChild ? <Tag>{t("tags.child")}</Tag> : null}
                        {g.isVIP ? <Tag>{t("tags.vip")}</Tag> : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                        {g.phone ? <span>{g.phone}</span> : null}
                        {g.email ? <span>{g.email}</span> : null}
                        {g.city ? <span>{g.city}</span> : null}
                        {g.dietary ? <span className="text-amber-300">🥗 {g.dietary}</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{g.groupName ?? "—"}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                        {g.side ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          RSVP_CHIP[g.rsvpStatus] ?? RSVP_CHIP.INVITED
                        }`}
                      >
                        {rsvpLabel(g.rsvpStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {g.plusOnesConfirmed}/{g.plusOnesAllowed}
                    </td>
                    <td className="px-4 py-3 text-xs">{g.tableNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleCheckin(g)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                          g.checkedInAt
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                      >
                        {g.checkedInAt ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> {t("attendance.arrived")}
                          </>
                        ) : (
                          t("attendance.mark")
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => copyRsvp(g)}
                          aria-label={t("rowActions.copyRsvp")}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        >
                          <Copy className="h-4 w-4" />
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
        <GuestFormModal
          mode={editing ? "edit" : "create"}
          guest={editing ?? undefined}
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
        title={deleting ? t("delete.confirmTitle", { name: deleting.name }) : t("delete.confirmTitleGeneric")}
        confirmLabel={tc("actions.delete")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300">
      {children}
    </span>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: "emerald" | "amber" | "rose";
}) {
  const accentClass =
    accent === "emerald" ? "text-emerald-300" : accent === "amber" ? "text-amber-300" : accent === "rose" ? "text-rose-300" : "text-zinc-100";
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>{value}</p>
      {sub ? <p className="text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function GuestFormModal({
  mode,
  guest,
  isBusy,
  onClose,
  formAction,
}: {
  mode: "create" | "edit";
  guest?: Guest;
  isBusy: boolean;
  onClose: () => void;
  formAction: (formData: FormData) => void;
}) {
  const t = useTranslations("dashboard.guests");
  const tc = useTranslations("common");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">
          {mode === "create" ? t("form.createTitle") : t("form.editTitle", { name: guest?.name ?? "" })}
        </h2>
        <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          {guest ? <input type="hidden" name="id" value={guest.id} /> : null}
          <Field name="name" label={t("form.name")} required defaultValue={guest?.name ?? ""} />
          <Field name="phone" label={t("form.phone")} defaultValue={guest?.phone ?? ""} />
          <Field name="email" label={t("form.email")} type="email" defaultValue={guest?.email ?? ""} />
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.side")}</label>
            <select
              name="side"
              defaultValue={guest?.side ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="">—</option>
              <option value="NOIVO">{t("side.groom")}</option>
              <option value="NOIVA">{t("side.bride")}</option>
              <option value="AMBOS">{t("side.both")}</option>
            </select>
          </div>
          <Field name="groupName" label={t("form.groupName")} defaultValue={guest?.groupName ?? ""} />
          <Field name="city" label={t("form.city")} defaultValue={guest?.city ?? ""} />
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.rsvpStatus")}</label>
            <select
              name="rsvpStatus"
              defaultValue={guest?.rsvpStatus ?? "INVITED"}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="NOT_INVITED">{t("rsvp.notInvited")}</option>
              <option value="INVITED">{t("rsvp.invited")}</option>
              <option value="CONFIRMED">{t("rsvp.confirmed")}</option>
              <option value="DECLINED">{t("rsvp.declined")}</option>
              <option value="MAYBE">{t("rsvp.maybe")}</option>
            </select>
          </div>
          <Field
            name="plusOnesAllowed"
            label={t("form.plusOnesAllowed")}
            type="number"
            defaultValue={guest?.plusOnesAllowed?.toString() ?? "0"}
          />
          <Field name="tableNumber" label={t("form.tableNumber")} defaultValue={guest?.tableNumber ?? ""} />
          <Field name="dietary" label={t("form.dietary")} defaultValue={guest?.dietary ?? ""} />
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" name="isChild" defaultChecked={guest?.isChild} className="accent-rose-500" />
              {t("form.isChild")}
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" name="isVIP" defaultChecked={guest?.isVIP} className="accent-rose-500" />
              {t("form.isVIP")}
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                name="isPadrinho"
                defaultChecked={guest?.isPadrinho}
                className="accent-rose-500"
              />
              {t("form.isPadrinho")}
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("form.notes")}</label>
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={guest?.notes ?? ""}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
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
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

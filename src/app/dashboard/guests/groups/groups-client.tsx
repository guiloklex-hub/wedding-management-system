"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Plus,
  Link2,
  Trash2,
  Edit3,
  Users,
  CheckCircle2,
  X,
  Search,
  Download,
  MessageCircle,
  PhoneOff,
  UserCheck,
} from "lucide-react";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination, usePagination } from "@/components/pagination";
import {
  createGuestGroup,
  deleteGuestGroup,
  setGroupMembers,
  updateGuestGroup,
} from "@/app/actions/guestGroupActions";
import { summarizeGroup, type GroupSummary } from "./group-summary";

type GuestRef = {
  id: string;
  name: string;
  groupId: string | null;
  rsvpStatus: string;
};

type GroupFilter = "ALL" | "NO_CONTACT" | "PENDING" | "ALL_CONFIRMED" | "EMPTY";
type GroupSort = "NAME" | "SIZE" | "PENDING";

type Group = {
  id: string;
  name: string;
  rsvpToken: string;
  rsvpPin: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  guests: { id: string; name: string; phone: string | null; email: string | null; rsvpStatus: string }[];
};

export default function GroupsClient({
  initialGroups,
  allGuests,
}: {
  initialGroups: Group[];
  allGuests: GuestRef[];
}) {
  const router = useRouter();
  const t = useTranslations("dashboard.guests.groups");
  const tc = useTranslations("common");
  const toast = useToast();
  const [groups, setGroups] = useState(initialGroups);
  const [guests, setGuests] = useState(allGuests);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [managingMembersOf, setManagingMembersOf] = useState<Group | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<GroupFilter>("ALL");
  const [sort, setSort] = useState<GroupSort>("NAME");
  const [, startTransition] = useTransition();

  const [prevGroupsProp, setPrevGroupsProp] = useState(initialGroups);
  const [prevGuestsProp, setPrevGuestsProp] = useState(allGuests);
  if (initialGroups !== prevGroupsProp) {
    setPrevGroupsProp(initialGroups);
    setGroups(initialGroups);
  }
  if (allGuests !== prevGuestsProp) {
    setPrevGuestsProp(allGuests);
    setGuests(allGuests);
  }

  const summaries = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    for (const g of groups) map.set(g.id, summarizeGroup(g));
    return map;
  }, [groups]);

  const stats = useMemo(() => {
    let people = 0;
    let noContact = 0;
    let pending = 0;
    for (const g of groups) {
      const s = summaries.get(g.id)!;
      people += s.memberCount;
      if (!s.willReceive) noContact += 1;
      if (s.pending > 0) pending += 1;
    }
    return { total: groups.length, people, noContact, pending };
  }, [groups, summaries]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = groups.filter((g) => {
      const s = summaries.get(g.id)!;
      if (filter === "NO_CONTACT" && s.willReceive) return false;
      if (filter === "PENDING" && s.pending === 0) return false;
      if (filter === "ALL_CONFIRMED" && !(s.memberCount > 0 && s.pending === 0 && s.declined === 0))
        return false;
      if (filter === "EMPTY" && s.memberCount > 0) return false;
      if (term && !`${g.name} ${g.contactName ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const sa = summaries.get(a.id)!;
      const sb = summaries.get(b.id)!;
      if (sort === "SIZE") return sb.memberCount - sa.memberCount || a.name.localeCompare(b.name);
      if (sort === "PENDING") return sb.pending - sa.pending || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [groups, summaries, search, filter, sort]);

  const { pageItems, page, totalPages, total, from, to, setPage } = usePagination(filtered, 12);

  function exportCsv() {
    const header = [
      t("csv.name"),
      t("csv.contact"),
      t("csv.phone"),
      t("csv.email"),
      t("csv.pin"),
      t("csv.people"),
      t("csv.confirmed"),
      t("csv.pending"),
      t("csv.declined"),
      t("csv.willReceive"),
    ].join(",");
    const rows = filtered.map((g) => {
      const s = summaries.get(g.id)!;
      return [
        g.name,
        g.contactName ?? "",
        s.effectivePhone ?? "",
        s.effectiveEmail ?? "",
        g.rsvpPin ?? "",
        s.memberCount,
        s.confirmed,
        s.pending,
        s.declined,
        s.willReceive ? t("csv.yes") : t("csv.no"),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const blob = new Blob([`${header}\n${rows.join("\n")}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("csv.fileName")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/rsvp/group/${token}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(t("toast.linkCopied"), url),
      () => toast.error(tc("common.errorGeneric"), t("toast.copyFailed")),
    );
  }

  async function handleCreate(formData: FormData) {
    setBusy(true);
    const res = await createGuestGroup(undefined, formData);
    setBusy(false);
    if (!res.success) {
      toast.error(tc("common.errorGeneric"), res.error);
      return;
    }
    toast.success(t("toast.created"));
    setShowCreate(false);
    startTransition(() => router.refresh());
  }

  async function handleEdit(formData: FormData) {
    if (!editing) return;
    formData.append("id", editing.id);
    setBusy(true);
    const res = await updateGuestGroup(undefined, formData);
    setBusy(false);
    if (!res.success) {
      toast.error(tc("common.errorGeneric"), res.error);
      return;
    }
    toast.success(t("toast.updated"));
    setEditing(null);
    startTransition(() => router.refresh());
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    const res = await deleteGuestGroup(confirmDelete.id);
    setBusy(false);
    if (!res.success) {
      toast.error(tc("common.errorGeneric"), res.error);
      return;
    }
    toast.success(t("toast.deleted"));
    setConfirmDelete(null);
    startTransition(() => router.refresh());
  }

  async function handleSaveMembers(guestIds: string[]) {
    if (!managingMembersOf) return;
    setBusy(true);
    const res = await setGroupMembers({ groupId: managingMembersOf.id, guestIds });
    setBusy(false);
    if (!res.success) {
      toast.error(tc("common.errorGeneric"), res.error);
      return;
    }
    toast.success(t("toast.membersUpdated"));
    setManagingMembersOf(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Link
        href="/dashboard/guests"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToGuests")}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 md:text-2xl">{t("title")}</h1>
          <p className="text-sm text-zinc-400">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {groups.length > 0 ? (
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              <Download className="h-4 w-4" />
              {t("exportCsv")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
          >
            <Plus className="h-4 w-4" />
            {t("newGroup")}
          </button>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
          <p className="text-sm text-zinc-400">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={t("stats.total")} value={stats.total} />
            <StatTile label={t("stats.people")} value={stats.people} />
            <StatTile label={t("stats.pending")} value={stats.pending} accent="amber" />
            <StatTile label={t("stats.noContact")} value={stats.noContact} accent="rose" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search.placeholder")}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as GroupSort)}
              aria-label={t("sort.label")}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            >
              <option value="NAME">{t("sort.name")}</option>
              <option value="SIZE">{t("sort.size")}</option>
              <option value="PENDING">{t("sort.pending")}</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["ALL", "NO_CONTACT", "PENDING", "ALL_CONFIRMED", "EMPTY"] as GroupFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  filter === f
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {t(`filter.${f}`)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
              <p className="text-sm text-zinc-400">{t("emptyFiltered")}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((g) => {
                const s = summaries.get(g.id)!;
                return (
                  <li key={g.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <header className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-zinc-100">{g.name}</h2>
                        {g.contactName ? (
                          <p className="text-xs text-zinc-500">{t("card.contact", { name: g.contactName })}</p>
                        ) : null}
                        {s.effectivePhone || s.effectiveEmail ? (
                          <p className="truncate text-xs text-zinc-500">
                            {s.effectivePhone ?? s.effectiveEmail}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                          {t("card.people", { count: s.memberCount })}
                        </span>
                        {g.rsvpPin ? (
                          <span className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-300">
                            {t("card.pin", { pin: g.rsvpPin })}
                          </span>
                        ) : null}
                      </div>
                    </header>

                    {!s.willReceive ? (
                      <p className="mb-2 inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">
                        <PhoneOff className="h-3 w-3" />
                        {t("card.willNotReceive")}
                      </p>
                    ) : s.usesFallback ? (
                      <p className="mb-2 inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
                        <UserCheck className="h-3 w-3" />
                        {t("card.usesFallback", { name: s.fallbackName ?? "" })}
                      </p>
                    ) : null}

                    <div className="mb-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                      <span className="rounded bg-emerald-500/10 px-1.5 py-1 text-emerald-300">
                        {t("card.yes", { count: s.confirmed })}
                      </span>
                      <span className="rounded bg-amber-500/10 px-1.5 py-1 text-amber-300">
                        {t("card.pending", { count: s.pending })}
                      </span>
                      <span className="rounded bg-rose-500/10 px-1.5 py-1 text-rose-300">
                        {t("card.no", { count: s.declined })}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyLink(g.rsvpToken)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {t("card.copyLink")}
                      </button>
                      {s.effectivePhone ? (
                        <a
                          href={`https://wa.me/${s.effectivePhone.replace(/\D+/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/50 px-2 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {t("card.whatsapp")}
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setManagingMembersOf(g)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                      >
                        <Users className="h-3.5 w-3.5" />
                        {t("card.members")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(g)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        {tc("actions.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(g)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {tc("actions.delete")}
                      </button>
                    </div>
                  </li>
                );
              })}
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
        </>
      )}

      {showCreate ? (
        <GroupForm
          title={t("form.createTitle")}
          busy={busy}
          onCancel={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      ) : null}

      {editing ? (
        <GroupForm
          title={t("form.editTitle")}
          initial={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSubmit={handleEdit}
        />
      ) : null}

      {managingMembersOf ? (
        <MembersDialog
          group={managingMembersOf}
          allGuests={guests}
          busy={busy}
          onCancel={() => setManagingMembersOf(null)}
          onSave={handleSaveMembers}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("delete.title")}
        description={
          confirmDelete
            ? t("delete.description", { name: confirmDelete.name })
            : ""
        }
        tone="danger"
        busy={busy}
        confirmLabel={tc("actions.delete")}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function GroupForm({
  title,
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial?: Pick<Group, "name" | "contactName" | "contactEmail" | "contactPhone" | "notes" | "guests" | "rsvpPin">;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const t = useTranslations("dashboard.guests.groups");
  const tc = useTranslations("common");
  const members = initial?.guests ?? [];
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [rsvpPin, setRsvpPin] = useState(initial?.rsvpPin ?? "");

  function generateRandomPin() {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setRsvpPin(pin);
  }

  function pickMember(guestId: string) {
    const member = members.find((m) => m.id === guestId);
    if (!member) return;
    setContactName(member.name);
    if (member.phone) setContactPhone(member.phone);
    if (member.email) setContactEmail(member.email);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <form
        action={onSubmit}
        className="my-4 w-full max-w-md space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        <FieldInput name="name" label={t("form.name")} defaultValue={initial?.name} required maxLength={120} />
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">{t("form.rsvpPin")}</span>
            <button
              type="button"
              onClick={generateRandomPin}
              className="text-xs font-medium text-rose-400 hover:text-rose-300"
            >
              {t("form.generatePin")}
            </button>
          </div>
          <input
            type="text"
            name="rsvpPin"
            value={rsvpPin}
            onChange={(e) => setRsvpPin(e.target.value)}
            placeholder="Ex.: 8696"
            maxLength={20}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-100 focus:border-rose-500 focus:outline-none"
          />
        </div>
        {members.length > 0 ? (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-400">{t("form.contactMember")}</span>
            <select
              defaultValue=""
              onChange={(e) => pickMember(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500 focus:outline-none"
            >
              <option value="">{t("form.contactMemberHint")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <FieldInput
          name="contactName"
          label={t("form.contactName")}
          value={contactName}
          onChange={setContactName}
          maxLength={120}
        />
        <div className="grid grid-cols-2 gap-3">
          <FieldInput
            name="contactEmail"
            label={t("form.email")}
            value={contactEmail}
            onChange={setContactEmail}
            type="email"
            maxLength={160}
          />
          <FieldInput
            name="contactPhone"
            label={t("form.phone")}
            value={contactPhone}
            onChange={setContactPhone}
            maxLength={40}
          />
        </div>
        <FieldTextarea
          name="notes"
          label={t("form.notes")}
          defaultValue={initial?.notes ?? ""}
          rows={2}
          maxLength={500}
        />
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            {tc("actions.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {busy ? t("form.saving") : tc("actions.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

function MembersDialog({
  group,
  allGuests,
  busy,
  onCancel,
  onSave,
}: {
  group: Group;
  allGuests: GuestRef[];
  busy: boolean;
  onCancel: () => void;
  onSave: (ids: string[]) => void;
}) {
  const t = useTranslations("dashboard.guests.groups");
  const tc = useTranslations("common");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(group.guests.map((g) => g.id)),
  );
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return allGuests
      .filter((g) => !g.groupId || g.groupId === group.id)
      .filter((g) => (f.length === 0 ? true : g.name.toLowerCase().includes(f)));
  }, [allGuests, filter, group.id]);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{t("members.title", { name: group.name })}</h2>
            <p className="text-xs text-zinc-500">{t("members.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={tc("actions.close")}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="border-b border-zinc-800 p-3">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("members.searchPlaceholder")}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500 focus:outline-none"
          />
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {visible.length === 0 ? (
            <p className="p-4 text-center text-sm text-zinc-500">{t("members.noneAvailable")}</p>
          ) : (
            visible.map((g) => {
              const isSelected = selected.has(g.id);
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => toggle(g.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                      isSelected
                        ? "bg-rose-500/10 text-rose-100"
                        : "text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 text-rose-400" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-zinc-600" />
                    )}
                    <span>{g.name}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <footer className="flex items-center justify-between border-t border-zinc-800 p-3">
          <span className="text-xs text-zinc-500">{t("members.selectedCount", { count: selected.size })}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              {tc("actions.cancel")}
            </button>
            <button
              type="button"
              onClick={() => onSave(Array.from(selected))}
              disabled={busy}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
            >
              {busy ? t("form.saving") : tc("actions.save")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "amber" | "rose";
}) {
  const accentClass =
    accent === "amber" ? "text-amber-300" : accent === "rose" ? "text-rose-300" : "text-zinc-100";
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}

function FieldInput({
  name,
  label,
  defaultValue,
  value,
  onChange,
  required,
  maxLength,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  type?: string;
}) {
  const controlled = onChange !== undefined;
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <input
        type={type}
        name={name}
        {...(controlled
          ? { value: value ?? "", onChange: (e) => onChange(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
        required={required}
        maxLength={maxLength}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500 focus:outline-none"
      />
    </label>
  );
}

function FieldTextarea({
  name,
  label,
  defaultValue,
  rows = 3,
  maxLength,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        maxLength={maxLength}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500 focus:outline-none"
      />
    </label>
  );
}

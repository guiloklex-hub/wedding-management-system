"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, Link2, Trash2, Edit3, Users, CheckCircle2, X } from "lucide-react";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  createGuestGroup,
  deleteGuestGroup,
  setGroupMembers,
  updateGuestGroup,
} from "@/app/actions/guestGroupActions";

type GuestRef = {
  id: string;
  name: string;
  groupId: string | null;
  rsvpStatus: string;
};

type Group = {
  id: string;
  name: string;
  rsvpToken: string;
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
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" />
          {t("newGroup")}
        </button>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
          <p className="text-sm text-zinc-400">{t("empty")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const confirmed = g.guests.filter((m) => m.rsvpStatus === "CONFIRMED").length;
            const declined = g.guests.filter((m) => m.rsvpStatus === "DECLINED").length;
            const pending = g.guests.length - confirmed - declined;
            return (
              <li
                key={g.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <header className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-zinc-100">{g.name}</h2>
                    {g.contactName ? (
                      <p className="text-xs text-zinc-500">{t("card.contact", { name: g.contactName })}</p>
                    ) : null}
                  </div>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                    {t("card.people", { count: g.guests.length })}
                  </span>
                </header>
                <div className="mb-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                  <span className="rounded bg-emerald-500/10 px-1.5 py-1 text-emerald-300">
                    {t("card.yes", { count: confirmed })}
                  </span>
                  <span className="rounded bg-amber-500/10 px-1.5 py-1 text-amber-300">
                    {t("card.pending", { count: pending })}
                  </span>
                  <span className="rounded bg-rose-500/10 px-1.5 py-1 text-rose-300">
                    {t("card.no", { count: declined })}
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
  initial?: Pick<Group, "name" | "contactName" | "contactEmail" | "contactPhone" | "notes" | "guests">;
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

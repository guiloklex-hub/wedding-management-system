"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  Check,
  Download,
  KeyRound,
  Loader2,
  Mail,
  MoreVertical,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { updatePixSettings, updateSettings } from "@/app/actions/settingsActions";
import {
  confirmTwoFactor,
  disableTwoFactor,
  startTwoFactorSetup,
} from "@/app/actions/securityActions";
import {
  connectWhatsApp,
  disconnectWhatsAppAction,
  getWhatsAppStatusAction,
  sendWhatsAppTest,
  type WhatsAppStatusPayload,
} from "@/app/actions/whatsappActions";
import {
  archiveUser,
  changeOwnPassword,
  createUser,
  resetUserPassword,
  resetUserTwoFactor,
  restoreUser,
  updateOwnProfile,
  updateSecuritySettings,
  updateUser,
} from "@/app/actions/userActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination, usePagination } from "@/components/pagination";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { ROLES, ROLE_LABEL, ROLE_DESCRIPTION, type Role, canManageUsers } from "@/lib/permissions";
import type { SecuritySettings } from "@/lib/security-settings";

type Initial = {
  eventDate: string;
  contingencyPercent: number;
  currency: string;
  coupleNames: string;
  rsvpReminderEnabled: boolean;
  rsvpReminderDays: number;
};

type PixSettings = {
  pixKey: string;
  pixKeyType: string;
  pixHolderName: string;
  pixCity: string;
};

type Me = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  twoFactorEnabled: boolean;
  twoFactorBackupCodes: string | null;
  lastLoginAt: Date | null;
  passwordUpdatedAt: Date | null;
  mustChangePassword: boolean;
} | null;

type Member = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  archivedAt: Date | null;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

const ROLE_OPTIONS: Role[] = [...ROLES];

type NotificationLogEntry = {
  id: string;
  kind: string;
  channel: string;
  targetEmail: string | null;
  targetPhone: string | null;
  status: string;
  errorMsg: string | null;
  createdAt: Date;
};

type Tab = "event" | "security" | "team" | "whatsapp" | "profile" | "backup" | "notifications";

export default function SettingsClient({
  initial,
  pixSettings,
  me,
  members,
  securitySettings,
  notificationLogs,
}: {
  initial: Initial;
  pixSettings: PixSettings;
  me: Me;
  members: Member[];
  securitySettings: SecuritySettings;
  notificationLogs: NotificationLogEntry[];
}) {
  const t = useTranslations("dashboard.settings");
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("event");
  const manageUsers = canManageUsers(me?.role);
  const isAdmin = me?.role === "ADMIN";

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 rounded-2xl bg-zinc-900/50 p-1 border border-zinc-800 max-w-fit">
        <TabBtn current={tab} value="event" onClick={() => setTab("event")}>
          {t("tabs.event")}
        </TabBtn>
        <TabBtn current={tab} value="security" onClick={() => setTab("security")}>
          {t("tabs.security")}
        </TabBtn>
        <TabBtn current={tab} value="team" onClick={() => setTab("team")}>
          {t("tabs.team")}
        </TabBtn>
        {manageUsers ? (
          <TabBtn current={tab} value="notifications" onClick={() => setTab("notifications")}>
            {t("tabs.notifications")}
          </TabBtn>
        ) : null}
        {isAdmin ? (
          <TabBtn current={tab} value="whatsapp" onClick={() => setTab("whatsapp")}>
            {t("tabs.whatsapp")}
          </TabBtn>
        ) : null}
        <TabBtn current={tab} value="profile" onClick={() => setTab("profile")}>
          {t("tabs.profile")}
        </TabBtn>
        <TabBtn current={tab} value="backup" onClick={() => setTab("backup")}>
          {t("tabs.backup")}
        </TabBtn>
      </nav>

      {tab === "event" ? (
        <EventTab initial={initial} pixSettings={pixSettings} toast={toast} />
      ) : null}
      {tab === "security" ? (
        <SecurityTab me={me} toast={toast} securitySettings={securitySettings} />
      ) : null}
      {tab === "team" ? (
        <TeamTab
          me={me}
          members={members}
          securitySettings={securitySettings}
          manageUsers={manageUsers}
          toast={toast}
        />
      ) : null}
      {tab === "whatsapp" && isAdmin ? <WhatsAppTab toast={toast} /> : null}
      {tab === "profile" ? <ProfileTab me={me} toast={toast} /> : null}
      {tab === "backup" ? <BackupTab isAdmin={isAdmin} toast={toast} /> : null}
      {tab === "notifications" && manageUsers ? (
        <NotificationsTab logs={notificationLogs} />
      ) : null}
    </div>
  );
}

function NotificationsTab({ logs }: { logs: NotificationLogEntry[] }) {
  const t = useTranslations("dashboard.settings");
  const { pageItems, page, totalPages, total, from, to, setPage } = usePagination(logs, 20);
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-rose-400" />
        <h2 className="text-lg font-semibold text-white">{t("notifications.title")}</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-500">{t("notifications.subtitle")}</p>
      {logs.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          {t("notifications.empty")}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3 font-medium">{t("notifications.col.when")}</th>
                <th className="py-2 pr-3 font-medium">{t("notifications.col.type")}</th>
                <th className="py-2 pr-3 font-medium">{t("notifications.col.channel")}</th>
                <th className="py-2 pr-3 font-medium">{t("notifications.col.recipient")}</th>
                <th className="py-2 pr-3 font-medium">{t("notifications.col.status")}</th>
                <th className="py-2 font-medium">{t("notifications.col.error")}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((l) => {
                const failed = l.status === "FAILED";
                return (
                  <tr key={l.id} className="border-b border-zinc-900 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-zinc-400">
                      {formatDateTimeBR(l.createdAt)}
                    </td>
                    <td className="py-2 pr-3 text-zinc-300">{l.kind}</td>
                    <td className="py-2 pr-3 text-zinc-400">{l.channel}</td>
                    <td className="py-2 pr-3 text-zinc-400">
                      {l.targetEmail ?? l.targetPhone ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          failed
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-rose-300/80 break-words">
                      {l.errorMsg ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              from={from}
              to={to}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function TabBtn({
  current,
  value,
  onClick,
  children,
}: {
  current: string;
  value: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-rose-600 text-white" : "text-zinc-300 hover:bg-zinc-800/50"
      }`}
    >
      {children}
    </button>
  );
}

function EventTab({
  initial,
  pixSettings,
  toast,
}: {
  initial: Initial;
  pixSettings: PixSettings;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.settings");
  const [, startTransition] = useTransition();
  const [isPending, setPending] = useState(false);
  const [pixPending, setPixPending] = useState(false);
  const [currency, setCurrency] = useState(initial.currency);
  const [pixKeyType, setPixKeyType] = useState(pixSettings.pixKeyType);

  function handleSubmit(formData: FormData) {
    setPending(true);
    startTransition(async () => {
      try {
        const r = await updateSettings(undefined, formData);
        if (r.success) toast.success(t("event.toast.saved"));
        else toast.error(t("event.toast.saveFailed"), r.error);
      } finally {
        setPending(false);
      }
    });
  }

  function handlePixSubmit(formData: FormData) {
    setPixPending(true);
    startTransition(async () => {
      try {
        const r = await updatePixSettings(undefined, formData);
        if (r.success) toast.success(t("event.toast.pixSaved"));
        else toast.error(t("event.toast.saveFailed"), r.error);
      } finally {
        setPixPending(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">{t("event.title")}</h2>
        <form action={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field name="coupleNames" label={t("event.coupleNames")} defaultValue={initial.coupleNames} />
          <Field name="eventDate" label={t("event.eventDate")} type="date" required defaultValue={initial.eventDate} />
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("event.currency")}</label>
            <select
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="BRL">{t("event.currencyBRL")}</option>
              <option value="USD">{t("event.currencyUSD")}</option>
              <option value="EUR">{t("event.currencyEUR")}</option>
            </select>
          </div>
          <Field
            name="contingencyPercent"
            label={t("event.contingency")}
            type="number"
            step="0.1"
            defaultValue={String(initial.contingencyPercent)}
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-300 sm:col-span-2">
            <input
              type="checkbox"
              name="rsvpReminderEnabled"
              defaultChecked={initial.rsvpReminderEnabled}
              className="accent-rose-500"
            />
            {t("event.rsvpReminderEnabled")}
          </label>
          <p className="-mt-2 text-xs text-zinc-500 sm:col-span-2">{t("event.rsvpReminderHint")}</p>
          <Field
            name="rsvpReminderDays"
            label={t("event.rsvpReminderDays")}
            type="number"
            min="1"
            max="90"
            defaultValue={String(initial.rsvpReminderDays)}
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("event.save")}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">{t("pix.title")}</h2>
        <p className="mt-1 text-xs text-zinc-500">{t("pix.subtitle")}</p>
        <form action={handlePixSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field name="pixKey" label={t("pix.key")} defaultValue={pixSettings.pixKey} />
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("pix.keyType")}</label>
            <select
              name="pixKeyType"
              value={pixKeyType}
              onChange={(e) => setPixKeyType(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="">—</option>
              <option value="CPF">{t("pix.typeCPF")}</option>
              <option value="CNPJ">{t("pix.typeCNPJ")}</option>
              <option value="EMAIL">{t("pix.typeEmail")}</option>
              <option value="PHONE">{t("pix.typePhone")}</option>
              <option value="RANDOM">{t("pix.typeRandom")}</option>
            </select>
          </div>
          <Field
            name="pixHolderName"
            label={t("pix.holderName")}
            defaultValue={pixSettings.pixHolderName}
          />
          <Field
            name="pixCity"
            label={t("pix.city")}
            defaultValue={pixSettings.pixCity}
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pixPending}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {pixPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("pix.save")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SecurityTab({
  me,
  toast,
  securitySettings,
}: {
  me: Me;
  toast: ReturnType<typeof useToast>;
  securitySettings: SecuritySettings;
}) {
  const t = useTranslations("dashboard.settings");
  const [, startTransition] = useTransition();
  const [setup, setSetup] = useState<{ secret: string; qrCodeSvg: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const required = me ? securitySettings.require2FARoles.includes(me.role as Role) : false;
  const missingRequired = required && !me?.twoFactorEnabled;

  function handleStart() {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await startTwoFactorSetup();
        if (r.success && r.data) setSetup({ secret: r.data.secret, qrCodeSvg: r.data.qrCodeSvg });
        else if (!r.success) toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleConfirm(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await confirmTwoFactor(undefined, formData);
        if (r.success && r.data) {
          setBackupCodes(r.data.backupCodes);
          setSetup(null);
          toast.success(t("security.toast.enabled"));
        } else if (!r.success) toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleDisable(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await disableTwoFactor(undefined, formData);
        if (r.success) toast.success(t("security.toast.disabled"));
        else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  if (!me) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-sm text-zinc-400">{t("security.loginRequired")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      {missingRequired ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>{t("security.requiredWarningStrong", { role: ROLE_LABEL[me.role as Role] ?? me.role })}</strong>
            {t("security.requiredWarningRest")}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{t("security.title")}</h2>
          <p className="text-sm text-zinc-500">
            {me.twoFactorEnabled
              ? t("security.descEnabled")
              : t("security.descDisabled")}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
            me.twoFactorEnabled
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-700 bg-zinc-800 text-zinc-400"
          }`}
        >
          {me.twoFactorEnabled ? (
            <>
              <ShieldCheck className="h-3 w-3" /> {t("security.badgeActive")}
            </>
          ) : (
            <>
              <ShieldOff className="h-3 w-3" /> {t("security.badgeInactive")}
            </>
          )}
        </span>
      </div>

      {!me.twoFactorEnabled && !setup ? (
        <button
          type="button"
          onClick={handleStart}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {t("security.enable")}
        </button>
      ) : null}

      {setup ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-zinc-300">{t("security.step1")}</p>
            <div
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2"
              dangerouslySetInnerHTML={{ __html: setup.qrCodeSvg }}
            />
            <p className="mt-2 text-[11px] text-zinc-500">
              {t("security.manualHint")}{" "}
              <code className="rounded bg-zinc-800 px-1 text-zinc-300">{setup.secret}</code>
            </p>
          </div>
          <form action={handleConfirm} className="space-y-3">
            <input type="hidden" name="secret" value={setup.secret} />
            <p className="text-sm text-zinc-300">{t("security.step2")}</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{t("security.codeLabel")}</label>
              <input
                type="text"
                name="token"
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoFocus
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-center text-lg tracking-widest text-zinc-200 outline-none focus:border-rose-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("security.confirmEnable")}
            </button>
            <button
              type="button"
              onClick={() => setSetup(null)}
              className="ml-2 text-xs text-zinc-400 hover:text-zinc-200"
            >
              {t("security.cancel")}
            </button>
          </form>
        </div>
      ) : null}

      {backupCodes ? (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-200">{t("security.backupTitle")}</p>
          <p className="mt-1 text-xs text-amber-100/70">{t("security.backupHint")}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
            {backupCodes.map((c) => (
              <li key={c} className="rounded-md bg-zinc-950 px-3 py-1 text-zinc-200">
                {c}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setBackupCodes(null)}
            className="mt-3 text-xs text-amber-200 hover:text-amber-100"
          >
            {t("security.backupDismiss")}
          </button>
        </div>
      ) : null}

      {me.twoFactorEnabled && !setup ? (
        <form
          action={handleDisable}
          className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-zinc-400">{t("security.disableLabel")}</label>
            <input
              type="text"
              name="token"
              required
              maxLength={11}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm tracking-widest text-zinc-200 outline-none focus:border-rose-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("security.disable")}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function TeamTab({
  me,
  members,
  securitySettings,
  manageUsers,
  toast,
}: {
  me: Me;
  members: Member[];
  securitySettings: SecuritySettings;
  manageUsers: boolean;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.settings");
  const isAdmin = me?.role === "ADMIN";
  const [, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [resetting, setResetting] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<
    | null
    | {
        title: string;
        description?: string;
        confirmLabel?: string;
        tone?: "default" | "danger";
        action: () => Promise<void>;
      }
  >(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (!showArchived && m.archivedAt) return false;
      if (roleFilter !== "ALL" && m.role !== roleFilter) return false;
      if (q && !(m.email.toLowerCase().includes(q) || (m.name ?? "").toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [members, search, roleFilter, showArchived]);

  function runAction(label: string, run: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await run();
      if (r.success) toast.success(label);
      else toast.error(t("toast.failed"), r.error);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{t("team.title")}</h2>
            <p className="text-sm text-zinc-500">
              {manageUsers
                ? t("team.subtitleManage")
                : t("team.subtitleReadonly")}
            </p>
          </div>
          {manageUsers ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 sm:self-auto"
            >
              <UserPlus className="h-4 w-4" /> {t("team.newUser")}
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("team.searchPlaceholder")}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "ALL" | Role)}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
          >
            <option value="ALL">{t("team.allRoles")}</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 accent-rose-500"
            />
            {t("team.showArchived")}
          </label>
        </div>

        <ul className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
              {t("team.noMembers")}
            </li>
          ) : null}
          {filtered.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              meId={me?.id}
              manageUsers={manageUsers}
              onEdit={() => setEditing(m)}
              onResetPassword={() => setResetting(m)}
              onResetTwoFactor={() =>
                setConfirm({
                  title: t("team.confirm.reset2faTitle", { name: m.name ?? m.email }),
                  description: t("team.confirm.reset2faDesc"),
                  confirmLabel: t("team.confirm.reset2faLabel"),
                  tone: "danger",
                  action: async () => {
                    runAction(t("team.toast.reset2fa"), () => resetUserTwoFactor(m.id));
                    setConfirm(null);
                  },
                })
              }
              onToggleActive={() => {
                const next = !m.isActive;
                setConfirm({
                  title: next
                    ? t("team.confirm.activateTitle", { name: m.name ?? m.email })
                    : t("team.confirm.deactivateTitle", { name: m.name ?? m.email }),
                  description: next
                    ? t("team.confirm.activateDesc")
                    : t("team.confirm.deactivateDesc"),
                  confirmLabel: next ? t("team.confirm.activateLabel") : t("team.confirm.deactivateLabel"),
                  tone: next ? "default" : "danger",
                  action: async () => {
                    const fd = new FormData();
                    fd.append("id", m.id);
                    fd.append("isActive", next ? "true" : "false");
                    runAction(next ? t("team.toast.activated") : t("team.toast.deactivated"), () =>
                      updateUser(undefined, fd),
                    );
                    setConfirm(null);
                  },
                });
              }}
              onArchive={() =>
                setConfirm({
                  title: t("team.confirm.archiveTitle", { name: m.name ?? m.email }),
                  description: t("team.confirm.archiveDesc"),
                  confirmLabel: t("team.confirm.archiveLabel"),
                  tone: "danger",
                  action: async () => {
                    runAction(t("team.toast.archived"), () => archiveUser(m.id));
                    setConfirm(null);
                  },
                })
              }
              onRestore={() =>
                setConfirm({
                  title: t("team.confirm.restoreTitle", { name: m.name ?? m.email }),
                  description: t("team.confirm.restoreDesc"),
                  confirmLabel: t("team.confirm.restoreLabel"),
                  action: async () => {
                    runAction(t("team.toast.restored"), () => restoreUser(m.id));
                    setConfirm(null);
                  },
                })
              }
            />
          ))}
        </ul>
      </section>

      {isAdmin ? (
        <SecuritySettingsCard initial={securitySettings} toast={toast} />
      ) : null}

      {createOpen ? (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          toast={toast}
          minPasswordLength={securitySettings.passwordMinLength}
        />
      ) : null}

      {editing ? (
        <EditUserModal
          member={editing}
          meId={me?.id}
          onClose={() => setEditing(null)}
          toast={toast}
        />
      ) : null}

      {resetting ? (
        <ResetPasswordModal
          member={resetting}
          onClose={() => setResetting(null)}
          toast={toast}
          minPasswordLength={securitySettings.passwordMinLength}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone}
        onConfirm={() => confirm?.action()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function MemberRow({
  member,
  meId,
  manageUsers,
  onEdit,
  onResetPassword,
  onResetTwoFactor,
  onToggleActive,
  onArchive,
  onRestore,
}: {
  member: Member;
  meId?: string;
  manageUsers: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onResetTwoFactor: () => void;
  onToggleActive: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const t = useTranslations("dashboard.settings");
  const [menuOpen, setMenuOpen] = useState(false);
  const isSelf = member.id === meId;
  const archived = !!member.archivedAt;

  return (
    <li
      className={`flex flex-col gap-2 rounded-xl border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
        archived
          ? "border-zinc-800/60 bg-zinc-950/30 opacity-70"
          : "border-zinc-800 bg-zinc-950/40"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            archived ? "bg-zinc-800 text-zinc-500" : "bg-rose-500/15 text-rose-200"
          }`}
        >
          {(member.name ?? member.email).charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm text-zinc-100">
            {member.name ?? member.email}
            {isSelf ? <span className="ml-1 text-[11px] text-rose-300">{t("team.row.you")}</span> : null}
          </p>
          <p className="text-[11px] text-zinc-500">
            {member.email} · {t("team.row.joined", { date: formatDateBR(member.createdAt) })}
            {member.lastLoginAt ? ` · ${t("team.row.lastLogin", { date: formatDateBR(member.lastLoginAt) })}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
          {ROLE_LABEL[member.role as Role] ?? member.role}
        </span>
        {archived ? (
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
            {t("team.row.archived")}
          </span>
        ) : member.isActive ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
            {t("team.row.active")}
          </span>
        ) : (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
            {t("team.row.inactive")}
          </span>
        )}
        {member.twoFactorEnabled ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> {t("team.row.twoFactor")}
          </span>
        ) : null}
        {member.mustChangePassword ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
            <KeyRound className="h-3 w-3" /> {t("team.row.tempPassword")}
          </span>
        ) : null}

        {manageUsers ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800"
              aria-label={t("team.row.actions")}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl">
                <MenuItem
                  icon={<Pencil className="h-4 w-4" />}
                  label={t("team.menu.edit")}
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  disabled={archived}
                />
                <MenuItem
                  icon={<KeyRound className="h-4 w-4" />}
                  label={t("team.menu.resetPassword")}
                  onClick={() => {
                    setMenuOpen(false);
                    onResetPassword();
                  }}
                  disabled={archived}
                />
                <MenuItem
                  icon={<RefreshCw className="h-4 w-4" />}
                  label={t("team.menu.reset2fa")}
                  onClick={() => {
                    setMenuOpen(false);
                    onResetTwoFactor();
                  }}
                  disabled={archived || !member.twoFactorEnabled}
                />
                <MenuItem
                  icon={member.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  label={member.isActive ? t("team.menu.deactivate") : t("team.menu.activate")}
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleActive();
                  }}
                  disabled={isSelf || archived}
                />
                {archived ? (
                  <MenuItem
                    icon={<ArchiveRestore className="h-4 w-4" />}
                    label={t("team.menu.restore")}
                    onClick={() => {
                      setMenuOpen(false);
                      onRestore();
                    }}
                  />
                ) : (
                  <MenuItem
                    icon={<Archive className="h-4 w-4" />}
                    label={t("team.menu.archive")}
                    onClick={() => {
                      setMenuOpen(false);
                      onArchive();
                    }}
                    disabled={isSelf}
                    danger
                  />
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
        disabled
          ? "cursor-not-allowed text-zinc-600"
          : danger
            ? "text-rose-200 hover:bg-rose-500/10"
            : "text-zinc-200 hover:bg-zinc-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CreateUserModal({
  onClose,
  toast,
  minPasswordLength,
}: {
  onClose: () => void;
  toast: ReturnType<typeof useToast>;
  minPasswordLength: number;
}) {
  const t = useTranslations("dashboard.settings");
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [password, setPassword] = useState("");

  function generate() {
    const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const len = Math.max(minPasswordLength, 12);
    let out = "";
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
    setPassword(out);
    setShowPwd(true);
  }

  function handle(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createUser(undefined, formData);
        if (r.success) {
          toast.success(t("team.toast.created"));
          onClose();
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Modal onClose={onClose} title={t("team.create.title")}>
      <form action={handle} className="space-y-3">
        <Field name="name" label={t("team.create.name")} required />
        <Field name="email" label={t("team.create.email")} type="email" required />
        <Field
          name="phone"
          label={t("team.create.phone")}
          placeholder="+5511999999999"
          pattern="^\+\d{10,15}$"
        />
        <p className="-mt-2 text-[11px] text-zinc-500">{t("team.create.phoneHint")}</p>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">
            {t("team.create.tempPassword", { min: minPasswordLength })}
          </label>
          <div className="flex gap-2">
            <input
              name="password"
              type={showPwd ? "text" : "password"}
              required
              minLength={minPasswordLength}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              {showPwd ? t("team.password.hide") : t("team.password.show")}
            </button>
            <button
              type="button"
              onClick={generate}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              {t("team.password.generate")}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">{t("team.create.mustChangeHint")}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">{t("team.create.role")}</label>
          <select
            name="role"
            defaultValue="PLANNER"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]} — {ROLE_DESCRIPTION[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            {t("team.create.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            {t("team.create.submit")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({
  member,
  meId,
  onClose,
  toast,
}: {
  member: Member;
  meId?: string;
  onClose: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.settings");
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const isSelf = member.id === meId;

  function handle(formData: FormData) {
    setBusy(true);
    formData.append("id", member.id);
    startTransition(async () => {
      try {
        const r = await updateUser(undefined, formData);
        if (r.success) {
          toast.success(t("team.toast.updated"));
          onClose();
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Modal onClose={onClose} title={t("team.edit.title", { name: member.name ?? member.email })}>
      <form action={handle} className="space-y-3">
        <Field name="name" label={t("team.edit.name")} required defaultValue={member.name ?? ""} />
        <Field name="email" label={t("team.edit.email")} type="email" required defaultValue={member.email} />
        <Field
          name="phone"
          label={t("team.edit.phone")}
          placeholder="+5511999999999"
          pattern="^\+\d{10,15}$"
          defaultValue={member.phone ?? ""}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">{t("team.edit.role")}</label>
          <select
            name="role"
            defaultValue={member.role}
            disabled={isSelf}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none disabled:opacity-60"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          {isSelf ? (
            <p className="mt-1 text-[11px] text-zinc-500">{t("team.edit.selfRoleHint")}</p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            {t("team.edit.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("team.edit.submit")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  member,
  onClose,
  toast,
  minPasswordLength,
}: {
  member: Member;
  onClose: () => void;
  toast: ReturnType<typeof useToast>;
  minPasswordLength: number;
}) {
  const t = useTranslations("dashboard.settings");
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  function generate() {
    const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const len = Math.max(minPasswordLength, 12);
    let out = "";
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
    setPassword(out);
    setShow(true);
  }

  function handle(formData: FormData) {
    setBusy(true);
    formData.append("id", member.id);
    startTransition(async () => {
      try {
        const r = await resetUserPassword(undefined, formData);
        if (r.success) {
          toast.success(t("team.toast.passwordReset"));
          onClose();
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Modal onClose={onClose} title={t("team.reset.title", { name: member.name ?? member.email })}>
      <form action={handle} className="space-y-3">
        <p className="text-sm text-zinc-400">{t("team.reset.hint")}</p>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">{t("team.reset.newPassword")}</label>
          <div className="flex gap-2">
            <input
              name="newPassword"
              type={show ? "text" : "password"}
              required
              minLength={minPasswordLength}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              {show ? t("team.password.hide") : t("team.password.show")}
            </button>
            <button
              type="button"
              onClick={generate}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              {t("team.password.generate")}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            {t("team.reset.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {t("team.reset.submit")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SecuritySettingsCard({
  initial,
  toast,
}: {
  initial: SecuritySettings;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.settings");
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Role[]>(initial.require2FARoles);
  const [minLen, setMinLen] = useState<number>(initial.passwordMinLength);

  function toggle(role: Role) {
    setSelected((cur) => (cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]));
  }

  function handle() {
    const fd = new FormData();
    fd.append("require2FARoles", JSON.stringify(selected));
    fd.append("passwordMinLength", String(minLen));
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await updateSecuritySettings(undefined, fd);
        if (r.success) toast.success(t("policy.toast.saved"));
        else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">{t("policy.title")}</h2>
      <p className="text-sm text-zinc-500">{t("policy.subtitle")}</p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-300">{t("policy.require2faLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((r) => {
              const active = selected.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(r)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  {active ? <Check className="h-3 w-3" /> : null}
                  {ROLE_LABEL[r]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">{t("policy.minPasswordLength")}</label>
          <input
            type="number"
            min={6}
            max={64}
            value={minLen}
            onChange={(e) => setMinLen(Number(e.target.value) || 8)}
            className="w-32 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
          />
        </div>

        <button
          type="button"
          onClick={handle}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("policy.save")}
        </button>
      </div>
    </section>
  );
}

function ProfileTab({
  me,
  toast,
}: {
  me: Me;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.settings");
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function handleName(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await updateOwnProfile(undefined, formData);
        if (r.success) toast.success(t("profile.toast.nameUpdated"));
        else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handlePassword(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await changeOwnPassword(undefined, formData);
        if (r.success) {
          toast.success(t("profile.toast.passwordUpdated"));
          (document.getElementById("own-password-form") as HTMLFormElement | null)?.reset();
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  if (!me) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-sm text-zinc-400">{t("profile.loginRequired")}</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">{t("profile.title")}</h2>
        <p className="text-sm text-zinc-500">
          {t("profile.emailLabel")} <span className="text-zinc-300">{me.email}</span> · {t("profile.roleLabel")}{" "}
          <span className="text-zinc-300">{ROLE_LABEL[me.role as Role] ?? me.role}</span>
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          {me.lastLoginAt ? `${t("profile.lastLogin", { date: formatDateTimeBR(me.lastLoginAt) })} · ` : ""}
          {me.passwordUpdatedAt ? t("profile.passwordUpdatedAt", { date: formatDateBR(me.passwordUpdatedAt) }) : t("profile.passwordNeverChanged")}
        </p>
        <form action={handleName} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field name="name" label={t("profile.displayName")} required defaultValue={me.name ?? ""} />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("profile.saveName")}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">{t("profile.changePasswordTitle")}</h2>
        <p className="text-sm text-zinc-500">{t("profile.changePasswordHint")}</p>
        <form id="own-password-form" action={handlePassword} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field name="currentPassword" label={t("profile.currentPassword")} type="password" required />
          <Field name="newPassword" label={t("profile.newPassword")} type="password" required />
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {t("profile.updatePassword")}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">{t("profile.twoFactorTitle")}</h2>
        <p className="text-sm text-zinc-500">
          {me.twoFactorEnabled
            ? t("profile.twoFactorEnabled")
            : t("profile.twoFactorDisabled")}
        </p>
        <p className="mt-3 inline-flex items-center gap-1 text-sm text-rose-300">
          <Users className="h-4 w-4" />
          {t("profile.twoFactorSeeTab")}
        </p>
      </section>
    </div>
  );
}

type BackupValidationResponse = {
  ok: boolean;
  version?: number;
  systemVersion?: number;
  exportedAt?: string;
  meta?: {
    appVersion?: string;
    hostname?: string;
    nodeVersion?: string;
    exportedBy?: { id?: string; email?: string | null };
  } | null;
  checksumValid?: boolean | null;
  checksum?: { algorithm: string; value: string } | null;
  counts?: Record<string, number>;
  warnings?: string[];
  error?: string;
  issues?: { path: string; message: string }[];
};

type BackupRestoreResponse = {
  ok?: boolean;
  counts?: Record<string, number>;
  warnings?: string[];
  protectedCurrentUser?: boolean;
  error?: string;
  issues?: { path: string; message: string }[];
};

function BackupTab({
  isAdmin,
  toast,
}: {
  isAdmin: boolean;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.settings");
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<BackupValidationResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [password, setPassword] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastRestore, setLastRestore] = useState<BackupRestoreResponse | null>(null);

  function reset() {
    setFile(null);
    setValidation(null);
    setPassword("");
    setAcknowledge(false);
  }

  async function handleValidate() {
    if (!file) {
      toast.error(t("backup.toast.selectFirst"));
      return;
    }
    setValidating(true);
    setValidation(null);
    setLastRestore(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/backup/validate", { method: "POST", body: fd });
      const body = (await res.json()) as BackupValidationResponse;
      setValidation(body);
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? t("backup.toast.invalidFile"));
      } else {
        toast.success(t("backup.toast.validated"));
      }
    } catch (err) {
      toast.error(t("backup.toast.validateFailed"), (err as Error).message);
    } finally {
      setValidating(false);
    }
  }

  async function handleRestore() {
    if (!file || !password || !acknowledge || !isAdmin) return;
    setRestoring(true);
    setConfirmOpen(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("password", password);
      fd.append("confirm", "WIPE_AND_RESTORE");
      const res = await fetch("/api/backup/restore", { method: "POST", body: fd });
      const body = (await res.json()) as BackupRestoreResponse;
      setLastRestore(body);
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? t("backup.toast.restoreFailed"));
      } else {
        toast.success(t("backup.toast.restored"));
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      toast.error(t("backup.toast.restoreError"), (err as Error).message);
    } finally {
      setRestoring(false);
    }
  }

  const canRestore =
    isAdmin &&
    !!validation?.ok &&
    !!file &&
    validation.checksumValid !== false &&
    password.length > 0 &&
    acknowledge;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">{t("backup.exportTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t("backup.exportSubtitle")}</p>
        <a
          href="/api/backup"
          download
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <Download className="h-4 w-4" /> {t("backup.exportButton")}
        </a>
        <p className="mt-3 text-xs text-zinc-500">{t("backup.exportHint")}</p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{t("backup.restoreTitle")}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isAdmin
              ? t("backup.restoreSubtitleAdmin")
              : t("backup.restoreSubtitleReadonly")}
          </p>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-zinc-400">{t("backup.fileLabel")}</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setValidation(null);
              setPassword("");
              setAcknowledge(false);
            }}
            className="mt-1 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-zinc-200 hover:file:bg-zinc-700"
          />
          {file ? (
            <p className="mt-1 text-xs text-zinc-500">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          ) : null}
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleValidate}
            disabled={!file || validating}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {t("backup.validateButton")}
          </button>
          {file ? (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              {t("backup.clear")}
            </button>
          ) : null}
        </div>

        {validation ? <ValidationSummary v={validation} /> : null}

        {isAdmin && validation?.ok && validation.checksumValid !== false ? (
          <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <div className="flex items-start gap-2 text-sm text-amber-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                <strong>{t("backup.warnStrong")}</strong>
                {t("backup.warnRest")}
              </span>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-zinc-400">{t("backup.passwordLabel")}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
                placeholder="••••••••"
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={acknowledge}
                onChange={(e) => setAcknowledge(e.target.checked)}
                className="mt-1"
              />
              <span>
                {t("backup.acknowledgeStart")} <strong>{t("backup.acknowledgeStrong")}</strong>
                {t("backup.acknowledgeEnd")}
              </span>
            </label>

            <button
              type="button"
              disabled={!canRestore || restoring}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-40"
            >
              {restoring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArchiveRestore className="h-4 w-4" />
              )}
              {t("backup.restoreNow")}
            </button>
          </div>
        ) : null}

        {lastRestore?.ok && lastRestore.counts ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm text-emerald-200">
            <p className="font-medium">{t("backup.restoreDone")}</p>
            <p className="mt-1 text-xs text-emerald-200/80">
              {t("backup.totalRestored")}{" "}
              {Object.entries(lastRestore.counts)
                .filter(([, c]) => c > 0)
                .map(([k, c]) => `${k}: ${c}`)
                .join(" · ") || t("backup.zeroRecords")}
            </p>
            {lastRestore.protectedCurrentUser ? (
              <p className="mt-1 text-xs text-emerald-200/80">{t("backup.accountPreserved")}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={t("backup.confirm.title")}
        description={t("backup.confirm.description")}
        confirmLabel={restoring ? t("backup.confirm.restoring") : t("backup.confirm.confirmLabel")}
        cancelLabel={t("backup.confirm.cancel")}
        onConfirm={handleRestore}
        onCancel={() => setConfirmOpen(false)}
        tone="danger"
        busy={restoring}
      />
    </div>
  );
}

function ValidationSummary({ v }: { v: BackupValidationResponse }) {
  const t = useTranslations("dashboard.settings");
  if (!v.ok) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-200">
        <p className="font-medium">{v.error ?? t("backup.validation.invalid")}</p>
        {v.issues && v.issues.length > 0 ? (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-rose-200/80">
            {v.issues.slice(0, 8).map((i, idx) => (
              <li key={idx}>
                <code className="text-rose-300">{i.path || t("backup.validation.root")}</code>: {i.message}
              </li>
            ))}
            {v.issues.length > 8 ? (
              <li>{t("backup.validation.moreIssues", { count: v.issues.length - 8 })}</li>
            ) : null}
          </ul>
        ) : null}
      </div>
    );
  }

  const totalRows =
    v.counts
      ? Object.values(v.counts).reduce((sum, n) => sum + n, 0)
      : 0;

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
      <p className="text-sm text-zinc-100">
        {t("backup.validation.summary", {
          version: v.version ?? 0,
          rows: totalRows,
          date: v.exportedAt ? formatDateTimeBR(new Date(v.exportedAt)) : "—",
        })}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
        {v.counts
          ? Object.entries(v.counts)
              .filter(([, c]) => c > 0)
              .map(([k, c]) => (
                <span key={k}>
                  <span className="text-zinc-500">{k}:</span> <strong>{c}</strong>
                </span>
              ))
          : null}
      </div>
      {v.meta?.hostname || v.meta?.appVersion ? (
        <p className="text-zinc-500">
          {v.meta?.hostname ? t("backup.validation.host", { host: v.meta.hostname }) : ""}
          {v.meta?.hostname && v.meta?.appVersion ? " · " : ""}
          {v.meta?.appVersion ? t("backup.validation.app", { version: v.meta.appVersion }) : ""}
        </p>
      ) : null}
      {v.checksum ? (
        <p className="text-zinc-500">
          {t("backup.validation.checksum")}{" "}
          <code className="text-zinc-300">{v.checksum.value.slice(0, 16)}…</code>{" "}
          {v.checksumValid ? "✓" : "✗"}
        </p>
      ) : null}
      {v.warnings && v.warnings.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-amber-300/80">
          {v.warnings.map((w, idx) => (
            <li key={idx}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("dashboard.settings");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
      <div className="my-4 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label={t("modal.close")}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function WhatsAppTab({
  toast,
}: {
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.settings");
  const [status, setStatus] = useState<WhatsAppStatusPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [testNumber, setTestNumber] = useState("");

  const refresh = useCallback(async () => {
    try {
      const s = await getWhatsAppStatusAction();
      setStatus(s);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      refresh();
    };
    const id = setInterval(tick, 3000);
    tick();
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refresh]);

  async function handleConnect() {
    setBusy(true);
    try {
      const r = await connectWhatsApp();
      if (!r.success) toast.error(t("toast.failed"), r.error);
      else toast.success(t("whatsapp.toast.connecting"));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      const r = await disconnectWhatsAppAction();
      if (!r.success) toast.error(t("toast.failed"), r.error);
      else toast.success(t("whatsapp.toast.disconnected"));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    if (!testNumber) {
      toast.error(t("whatsapp.toast.numberRequired"));
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("phone", testNumber);
      const r = await sendWhatsAppTest(undefined, fd);
      if (r.success) toast.success(t("whatsapp.toast.testSent"));
      else toast.error(t("toast.failed"), r.error);
    } finally {
      setBusy(false);
    }
  }

  const state = status?.state ?? "DISCONNECTED";
  const label =
    state === "CONNECTED"
      ? status?.phoneNumber
        ? t("whatsapp.status.connectedWithPhone", { phone: status.phoneNumber })
        : t("whatsapp.status.connected")
      : state === "WAITING_QR"
        ? t("whatsapp.status.waitingQr")
        : state === "CONNECTING"
          ? t("whatsapp.status.connecting")
          : t("whatsapp.status.disconnected");

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-rose-400" />
          <h2 className="text-lg font-semibold text-zinc-100">{t("whatsapp.title")}</h2>
        </div>
        <p className="text-sm text-zinc-500">{t("whatsapp.subtitle")}</p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            state === "CONNECTED"
              ? "bg-emerald-400"
              : state === "WAITING_QR" || state === "CONNECTING"
                ? "bg-amber-400 animate-pulse"
                : "bg-zinc-600"
          }`}
        />
        <span className="text-sm text-zinc-200">{label}</span>
        {status?.lastError ? (
          <span className="ml-auto text-xs text-rose-300">{status.lastError}</span>
        ) : null}
      </div>

      {state === "DISCONNECTED" && status?.needsManualAction ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {t("whatsapp.needsManualAction")}
        </div>
      ) : null}

      {state === "DISCONNECTED" && !status?.needsManualAction && (status?.attempts ?? 0) > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {t("whatsapp.reconnecting", { attempts: status?.attempts ?? 0 })}
          {status?.lastDisconnectAt
            ? ` · ${t("whatsapp.lastDisconnect", { date: new Date(status.lastDisconnectAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) })}`
            : ""}
        </div>
      ) : null}

      {state === "WAITING_QR" && status?.qrDataUrl ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="mb-3 text-sm text-zinc-300">{t("whatsapp.qrInstructions")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={status.qrDataUrl}
            alt={t("whatsapp.qrAlt")}
            className="mx-auto h-64 w-64 rounded-lg bg-white p-2"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {state === "CONNECTED" ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}
            {t("whatsapp.disconnect")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy || state === "CONNECTING"}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy || state === "CONNECTING" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            {state === "WAITING_QR" ? t("whatsapp.reopenQr") : t("whatsapp.connect")}
          </button>
        )}

        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className="h-4 w-4" /> {t("whatsapp.refresh")}
        </button>
      </div>

      {state === "CONNECTED" ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="mb-2 text-sm font-medium text-zinc-300">{t("whatsapp.testTitle")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="+5511999999999"
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("whatsapp.sendTest")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  step,
  min,
  max,
  defaultValue,
  placeholder,
  pattern,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  step?: string;
  min?: string;
  max?: string;
  defaultValue?: string;
  placeholder?: string;
  pattern?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue}
        placeholder={placeholder}
        pattern={pattern}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

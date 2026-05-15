"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Download,
  KeyRound,
  Loader2,
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
import { updateSettings } from "@/app/actions/settingsActions";
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
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { ROLES, ROLE_LABEL, ROLE_DESCRIPTION, type Role, canManageUsers } from "@/lib/permissions";
import type { SecuritySettings } from "@/lib/security-settings";

type Initial = {
  eventDate: string;
  contingencyPercent: number;
  currency: string;
  coupleNames: string;
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

type Tab = "event" | "security" | "team" | "whatsapp" | "profile" | "backup";

export default function SettingsClient({
  initial,
  me,
  members,
  securitySettings,
}: {
  initial: Initial;
  me: Me;
  members: Member[];
  securitySettings: SecuritySettings;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("event");
  const manageUsers = canManageUsers(me?.role);
  const isAdmin = me?.role === "ADMIN";

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 rounded-2xl bg-zinc-900/50 p-1 border border-zinc-800 max-w-fit">
        <TabBtn current={tab} value="event" onClick={() => setTab("event")}>
          Casamento
        </TabBtn>
        <TabBtn current={tab} value="security" onClick={() => setTab("security")}>
          Segurança
        </TabBtn>
        <TabBtn current={tab} value="team" onClick={() => setTab("team")}>
          Time
        </TabBtn>
        {isAdmin ? (
          <TabBtn current={tab} value="whatsapp" onClick={() => setTab("whatsapp")}>
            WhatsApp
          </TabBtn>
        ) : null}
        <TabBtn current={tab} value="profile" onClick={() => setTab("profile")}>
          Perfil
        </TabBtn>
        <TabBtn current={tab} value="backup" onClick={() => setTab("backup")}>
          Backup
        </TabBtn>
      </nav>

      {tab === "event" ? <EventTab initial={initial} toast={toast} /> : null}
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
      {tab === "backup" ? <BackupTab /> : null}
    </div>
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
  toast,
}: {
  initial: Initial;
  toast: ReturnType<typeof useToast>;
}) {
  const [, startTransition] = useTransition();
  const [isPending, setPending] = useState(false);

  function handleSubmit(formData: FormData) {
    setPending(true);
    startTransition(async () => {
      try {
        const r = await updateSettings(undefined, formData);
        if (r.success) toast.success("Configurações salvas");
        else toast.error("Falha ao salvar", r.error);
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Dados do casamento</h2>
      <form action={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field name="coupleNames" label="Nomes do casal" defaultValue={initial.coupleNames} />
        <Field name="eventDate" label="Data do evento" type="date" required defaultValue={initial.eventDate} />
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">Moeda</label>
          <select
            name="currency"
            defaultValue={initial.currency}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
          >
            <option value="BRL">Real (BRL)</option>
            <option value="USD">Dólar (USD)</option>
            <option value="EUR">Euro (EUR)</option>
          </select>
        </div>
        <Field
          name="contingencyPercent"
          label="Contingência (%)"
          type="number"
          step="0.1"
          defaultValue={String(initial.contingencyPercent)}
        />
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </form>
    </section>
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
        else if (!r.success) toast.error("Falha", r.error);
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
          toast.success("2FA ativado");
        } else if (!r.success) toast.error("Falha", r.error);
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
        if (r.success) toast.success("2FA desativado");
        else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  if (!me) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-sm text-zinc-400">Faça login para gerenciar segurança.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      {missingRequired ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>2FA obrigatório para sua função ({ROLE_LABEL[me.role as Role] ?? me.role})</strong>
            . Configure agora para manter acesso garantido.
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Autenticação em dois fatores (2FA)</h2>
          <p className="text-sm text-zinc-500">
            {me.twoFactorEnabled
              ? "Ativada — login pede código do app autenticador."
              : "Adicione uma camada extra usando Google Authenticator, 1Password ou similar."}
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
              <ShieldCheck className="h-3 w-3" /> Ativa
            </>
          ) : (
            <>
              <ShieldOff className="h-3 w-3" /> Inativa
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
          Ativar 2FA
        </button>
      ) : null}

      {setup ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-zinc-300">
              1. Escaneie o QR Code com seu app autenticador (Google Authenticator, 1Password, Authy).
            </p>
            <div
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2"
              dangerouslySetInnerHTML={{ __html: setup.qrCodeSvg }}
            />
            <p className="mt-2 text-[11px] text-zinc-500">
              Se não conseguir escanear, digite manualmente:{" "}
              <code className="rounded bg-zinc-800 px-1 text-zinc-300">{setup.secret}</code>
            </p>
          </div>
          <form action={handleConfirm} className="space-y-3">
            <input type="hidden" name="secret" value={setup.secret} />
            <p className="text-sm text-zinc-300">2. Confirme com o código atual mostrado no app.</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Código de 6 dígitos</label>
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
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar e ativar"}
            </button>
            <button
              type="button"
              onClick={() => setSetup(null)}
              className="ml-2 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancelar
            </button>
          </form>
        </div>
      ) : null}

      {backupCodes ? (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-200">🔑 Guarde estes códigos de backup</p>
          <p className="mt-1 text-xs text-amber-100/70">
            Use no lugar do código TOTP se perder acesso ao app. Cada um só funciona uma vez.
          </p>
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
            Já anotei, ocultar
          </button>
        </div>
      ) : null}

      {me.twoFactorEnabled && !setup ? (
        <form
          action={handleDisable}
          className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-zinc-400">
              Para desativar, digite um código TOTP ou de backup
            </label>
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desativar 2FA"}
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
      else toast.error("Falha", r.error);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Membros</h2>
            <p className="text-sm text-zinc-500">
              {manageUsers
                ? "Crie usuários direto. O sistema envia as credenciais por email e/ou WhatsApp."
                : "Apenas administradores e os noivos podem gerenciar membros."}
            </p>
          </div>
          {manageUsers ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 sm:self-auto"
            >
              <UserPlus className="h-4 w-4" /> Novo usuário
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "ALL" | Role)}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
          >
            <option value="ALL">Todas as funções</option>
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
            Mostrar arquivados
          </label>
        </div>

        <ul className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
              Nenhum membro encontrado com os filtros atuais.
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
                  title: `Redefinir 2FA de ${m.name ?? m.email}?`,
                  description: "Os códigos atuais deixarão de funcionar. O usuário precisará configurar novamente.",
                  confirmLabel: "Redefinir",
                  tone: "danger",
                  action: async () => {
                    runAction("2FA redefinido", () => resetUserTwoFactor(m.id));
                    setConfirm(null);
                  },
                })
              }
              onToggleActive={() => {
                const next = !m.isActive;
                setConfirm({
                  title: next ? `Reativar ${m.name ?? m.email}?` : `Desativar ${m.name ?? m.email}?`,
                  description: next
                    ? "O usuário voltará a poder fazer login."
                    : "O usuário não poderá entrar até ser reativado.",
                  confirmLabel: next ? "Reativar" : "Desativar",
                  tone: next ? "default" : "danger",
                  action: async () => {
                    const fd = new FormData();
                    fd.append("id", m.id);
                    fd.append("isActive", next ? "true" : "false");
                    runAction(next ? "Usuário reativado" : "Usuário desativado", () =>
                      updateUser(undefined, fd),
                    );
                    setConfirm(null);
                  },
                });
              }}
              onArchive={() =>
                setConfirm({
                  title: `Arquivar ${m.name ?? m.email}?`,
                  description: "O usuário é desativado e some da lista (pode ser restaurado depois).",
                  confirmLabel: "Arquivar",
                  tone: "danger",
                  action: async () => {
                    runAction("Usuário arquivado", () => archiveUser(m.id));
                    setConfirm(null);
                  },
                })
              }
              onRestore={() =>
                setConfirm({
                  title: `Restaurar ${m.name ?? m.email}?`,
                  description: "O usuário volta para a lista ativa.",
                  confirmLabel: "Restaurar",
                  action: async () => {
                    runAction("Usuário restaurado", () => restoreUser(m.id));
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
            {isSelf ? <span className="ml-1 text-[11px] text-rose-300">(você)</span> : null}
          </p>
          <p className="text-[11px] text-zinc-500">
            {member.email} · entrou {formatDateBR(member.createdAt)}
            {member.lastLoginAt ? ` · último login ${formatDateBR(member.lastLoginAt)}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
          {ROLE_LABEL[member.role as Role] ?? member.role}
        </span>
        {archived ? (
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
            Arquivado
          </span>
        ) : member.isActive ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
            Ativo
          </span>
        ) : (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
            Inativo
          </span>
        )}
        {member.twoFactorEnabled ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> 2FA
          </span>
        ) : null}
        {member.mustChangePassword ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
            <KeyRound className="h-3 w-3" /> Senha provisória
          </span>
        ) : null}

        {manageUsers ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800"
              aria-label="Ações"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl">
                <MenuItem
                  icon={<Pencil className="h-4 w-4" />}
                  label="Editar"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  disabled={archived}
                />
                <MenuItem
                  icon={<KeyRound className="h-4 w-4" />}
                  label="Redefinir senha"
                  onClick={() => {
                    setMenuOpen(false);
                    onResetPassword();
                  }}
                  disabled={archived}
                />
                <MenuItem
                  icon={<RefreshCw className="h-4 w-4" />}
                  label="Redefinir 2FA"
                  onClick={() => {
                    setMenuOpen(false);
                    onResetTwoFactor();
                  }}
                  disabled={archived || !member.twoFactorEnabled}
                />
                <MenuItem
                  icon={member.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  label={member.isActive ? "Desativar" : "Reativar"}
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleActive();
                  }}
                  disabled={isSelf || archived}
                />
                {archived ? (
                  <MenuItem
                    icon={<ArchiveRestore className="h-4 w-4" />}
                    label="Restaurar"
                    onClick={() => {
                      setMenuOpen(false);
                      onRestore();
                    }}
                  />
                ) : (
                  <MenuItem
                    icon={<Archive className="h-4 w-4" />}
                    label="Arquivar"
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
          toast.success("Usuário criado");
          onClose();
        } else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Modal onClose={onClose} title="Novo usuário">
      <form action={handle} className="space-y-3">
        <Field name="name" label="Nome" required />
        <Field name="email" label="Email" type="email" required />
        <Field
          name="phone"
          label="Telefone (WhatsApp, opcional)"
          placeholder="+5511999999999"
          pattern="^\+\d{10,15}$"
        />
        <p className="-mt-2 text-[11px] text-zinc-500">
          Formato E.164 (com + e DDI). Usado para enviar credenciais e lembretes.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">
            Senha provisória (mínimo {minPasswordLength} caracteres)
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
              {showPwd ? "Ocultar" : "Mostrar"}
            </button>
            <button
              type="button"
              onClick={generate}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Gerar
            </button>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            O usuário será obrigado a trocar a senha no primeiro login.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">Função</label>
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
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            Criar usuário
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
          toast.success("Usuário atualizado");
          onClose();
        } else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Modal onClose={onClose} title={`Editar ${member.name ?? member.email}`}>
      <form action={handle} className="space-y-3">
        <Field name="name" label="Nome" required defaultValue={member.name ?? ""} />
        <Field
          name="phone"
          label="Telefone (WhatsApp, opcional)"
          placeholder="+5511999999999"
          pattern="^\+\d{10,15}$"
          defaultValue={member.phone ?? ""}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">Função</label>
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
            <p className="mt-1 text-[11px] text-zinc-500">Você não pode alterar a própria função.</p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
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
          toast.success("Senha redefinida — compartilhe a nova com o usuário");
          onClose();
        } else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Modal onClose={onClose} title={`Redefinir senha de ${member.name ?? member.email}`}>
      <form action={handle} className="space-y-3">
        <p className="text-sm text-zinc-400">
          O usuário será obrigado a trocar a senha no próximo login.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">Nova senha provisória</label>
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
              {show ? "Ocultar" : "Mostrar"}
            </button>
            <button
              type="button"
              onClick={generate}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Gerar
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Redefinir
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
        if (r.success) toast.success("Política de segurança salva");
        else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Política de segurança</h2>
      <p className="text-sm text-zinc-500">
        Defina quem precisa de 2FA obrigatório e o tamanho mínimo de senha.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-300">2FA obrigatório nas funções:</p>
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
          <label className="mb-1 block text-sm font-medium text-zinc-400">
            Tamanho mínimo da senha
          </label>
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
          Salvar política
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
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function handleName(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await updateOwnProfile(undefined, formData);
        if (r.success) toast.success("Nome atualizado");
        else toast.error("Falha", r.error);
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
          toast.success("Senha atualizada");
          (document.getElementById("own-password-form") as HTMLFormElement | null)?.reset();
        } else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  if (!me) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-sm text-zinc-400">Faça login para gerenciar o perfil.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Meu perfil</h2>
        <p className="text-sm text-zinc-500">
          Email: <span className="text-zinc-300">{me.email}</span> · Função:{" "}
          <span className="text-zinc-300">{ROLE_LABEL[me.role as Role] ?? me.role}</span>
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          {me.lastLoginAt ? `Último login: ${formatDateTimeBR(me.lastLoginAt)} · ` : ""}
          {me.passwordUpdatedAt ? `Senha atualizada em ${formatDateBR(me.passwordUpdatedAt)}` : "Senha nunca trocada"}
        </p>
        <form action={handleName} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field name="name" label="Nome de exibição" required defaultValue={me.name ?? ""} />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar nome
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Trocar minha senha</h2>
        <p className="text-sm text-zinc-500">
          Digite a senha atual e a nova. A nova precisa ser diferente da atual.
        </p>
        <form id="own-password-form" action={handlePassword} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field name="currentPassword" label="Senha atual" type="password" required />
          <Field name="newPassword" label="Nova senha" type="password" required />
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Atualizar senha
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Autenticação em dois fatores</h2>
        <p className="text-sm text-zinc-500">
          {me.twoFactorEnabled
            ? "Ativada. Você pode desativar na aba Segurança."
            : "Inativa. Ative na aba Segurança para reforçar sua conta."}
        </p>
        <p className="mt-3 inline-flex items-center gap-1 text-sm text-rose-300">
          <Users className="h-4 w-4" />
          Veja a aba “Segurança” para configurar.
        </p>
      </section>
    </div>
  );
}

function BackupTab() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Backup</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Baixa um JSON com fornecedores, pagamentos, aportes, configurações, convidados e tudo mais.
      </p>
      <a
        href="/api/backup"
        download
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
      >
        <Download className="h-4 w-4" /> Exportar backup JSON
      </a>
      <p className="mt-3 text-xs text-zinc-500">Faça um backup mensal e antes/depois do casamento.</p>
    </section>
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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Fechar"
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
      if (!r.success) toast.error("Falha", r.error);
      else toast.success("Iniciando conexão. Escaneie o QR Code.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      const r = await disconnectWhatsAppAction();
      if (!r.success) toast.error("Falha", r.error);
      else toast.success("WhatsApp desconectado");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    if (!testNumber) {
      toast.error("Informe um número");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("phone", testNumber);
      const r = await sendWhatsAppTest(undefined, fd);
      if (r.success) toast.success("Mensagem de teste enviada");
      else toast.error("Falha", r.error);
    } finally {
      setBusy(false);
    }
  }

  const state = status?.state ?? "DISCONNECTED";
  const label =
    state === "CONNECTED"
      ? `Conectado${status?.phoneNumber ? ` (${status.phoneNumber})` : ""}`
      : state === "WAITING_QR"
        ? "Aguardando leitura do QR Code"
        : state === "CONNECTING"
          ? "Conectando..."
          : "Desconectado";

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-rose-400" />
          <h2 className="text-lg font-semibold text-zinc-100">WhatsApp</h2>
        </div>
        <p className="text-sm text-zinc-500">
          Conecte um número para enviar credenciais, lembretes e redefinições
          de senha pelo WhatsApp.
        </p>
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

      {state === "WAITING_QR" && status?.qrDataUrl ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="mb-3 text-sm text-zinc-300">
            Abra o WhatsApp no celular → Configurações → Aparelhos conectados →
            Conectar um aparelho. Escaneie:
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={status.qrDataUrl}
            alt="QR Code do WhatsApp"
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
            Desconectar
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
            {state === "WAITING_QR" ? "Reabrir QR" : "Conectar"}
          </button>
        )}

        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      {state === "CONNECTED" ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="mb-2 text-sm font-medium text-zinc-300">Enviar mensagem de teste</p>
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
              Enviar teste
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
  defaultValue,
  placeholder,
  pattern,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  step?: string;
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
        defaultValue={defaultValue}
        placeholder={placeholder}
        pattern={pattern}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

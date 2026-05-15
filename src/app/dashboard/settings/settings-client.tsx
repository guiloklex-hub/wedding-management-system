"use client";

import { useState, useTransition } from "react";
import {
  Copy,
  Download,
  Loader2,
  Save,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
} from "lucide-react";
import { updateSettings } from "@/app/actions/settingsActions";
import {
  confirmTwoFactor,
  createInvite,
  disableTwoFactor,
  revokeInvite,
  startTwoFactorSetup,
} from "@/app/actions/securityActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";

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
} | null;

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Dono",
  PARTNER: "Parceiro(a)",
  VIEWER: "Leitura",
  USER: "Usuário",
  ADMIN: "Admin",
};

export default function SettingsClient({
  initial,
  me,
  members,
  invites,
}: {
  initial: Initial;
  me: Me;
  members: Member[];
  invites: Invite[];
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"event" | "security" | "team" | "backup">("event");

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
        <TabBtn current={tab} value="backup" onClick={() => setTab("backup")}>
          Backup
        </TabBtn>
      </nav>

      {tab === "event" ? <EventTab initial={initial} toast={toast} /> : null}
      {tab === "security" ? <SecurityTab me={me} toast={toast} /> : null}
      {tab === "team" ? <TeamTab me={me} members={members} invites={invites} toast={toast} /> : null}
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
}: {
  me: Me;
  toast: ReturnType<typeof useToast>;
}) {
  const [, startTransition] = useTransition();
  const [setup, setSetup] = useState<{ secret: string; qrCodeSvg: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

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
          <p className="text-sm font-semibold text-amber-200">
            🔑 Guarde estes códigos de backup
          </p>
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
        <form action={handleDisable} className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:flex-row sm:items-end">
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
  invites,
  toast,
}: {
  me: Me;
  members: Member[];
  invites: Invite[];
  toast: ReturnType<typeof useToast>;
}) {
  const isOwner = me?.role === "OWNER";
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  function handleInvite(formData: FormData) {
    setBusy(true);
    setCreatedLink(null);
    startTransition(async () => {
      try {
        const r = await createInvite(undefined, formData);
        if (r.success && r.data) {
          setCreatedLink(`${window.location.origin}/invite/${r.data.token}`);
          toast.success("Convite criado");
        } else if (!r.success) toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleRevoke() {
    if (!revoking) return;
    const id = revoking.id;
    startTransition(async () => {
      const r = await revokeInvite(id);
      if (r.success) {
        toast.success("Convite revogado");
        setRevoking(null);
      } else toast.error("Falha", r.error);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Membros</h2>
        <p className="text-sm text-zinc-500">
          Quem tem acesso ao planejamento. Apenas o dono pode convidar novos membros.
        </p>
        <ul className="mt-4 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2">
              <div>
                <p className="text-sm text-zinc-100">{m.name ?? m.email}</p>
                <p className="text-[11px] text-zinc-500">
                  {m.email} · entrou {formatDateBR(m.createdAt)}
                </p>
              </div>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {isOwner ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Convidar membro</h2>
          <form action={handleInvite} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="email" label="Email" type="email" required />
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Permissão</label>
              <select
                name="role"
                defaultValue="PARTNER"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="PARTNER">Parceiro(a) — edita tudo</option>
                <option value="VIEWER">Leitura — só visualiza</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-400">Recado (opcional)</label>
              <textarea
                name="message"
                rows={2}
                maxLength={500}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Gerar convite
              </button>
            </div>
          </form>

          {createdLink ? (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-200">
              <p>Convite criado. Compartilhe este link via WhatsApp ou outro canal:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-zinc-950 px-2 py-1 font-mono text-xs">
                  {createdLink}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(createdLink);
                    toast.success("Copiado");
                  }}
                  className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-500/10"
                  aria-label="Copiar"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          {invites.length > 0 ? (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-zinc-300">Convites pendentes</p>
              <ul className="space-y-2">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                    <div>
                      <p className="text-sm text-zinc-200">{inv.email}</p>
                      <p className="text-[11px] text-zinc-500">
                        {ROLE_LABEL[inv.role] ?? inv.role} · criado {formatDateTimeBR(inv.createdAt)} · expira {formatDateBR(inv.expiresAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`);
                          toast.success("Link copiado");
                        }}
                        className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800"
                        aria-label="Copiar link"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevoking(inv)}
                        className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-500/10"
                        aria-label="Revogar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ConfirmDialog
            open={!!revoking}
            title="Revogar convite?"
            description={revoking ? `O link enviado para ${revoking.email} deixará de funcionar.` : undefined}
            confirmLabel="Revogar"
            tone="danger"
            onConfirm={handleRevoke}
            onCancel={() => setRevoking(null)}
          />
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-500">
          Apenas o dono pode convidar novos membros.
        </section>
      )}
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
      <p className="mt-3 text-xs text-zinc-500">
        Faça um backup mensal e antes/depois do casamento.
      </p>
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

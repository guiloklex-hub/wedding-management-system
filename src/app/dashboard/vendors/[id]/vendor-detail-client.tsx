"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  Star,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency, formatDateBR, formatDateTimeBR } from "@/lib/format";
import {
  createVendorContact,
  deleteVendorContact,
} from "@/app/actions/vendorContactActions";
import {
  createVendorNote,
  deleteVendorNote,
} from "@/app/actions/vendorNoteActions";
import {
  createContract,
  deleteContract,
  replaceContractFile,
  signContract,
} from "@/app/actions/contractActions";
import {
  canSignContract,
  canUploadContract,
  canViewContract,
} from "@/lib/permissions";
import {
  deleteAttachment,
  uploadAttachment,
} from "@/app/actions/attachmentActions";
import type { Vendor as VendorBase } from "@/types";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
};
type Note = { id: string; body: string; kind: string; createdAt: string | Date };
type ContractAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  version: number;
  sha256Full: string | null;
  createdAt: Date | string;
  deletedAt: Date | string | null;
  uploadedBy: { id: string; name: string | null; email: string } | null;
};
type Contract = {
  id: string;
  title: string;
  version: number;
  status: string;
  signedAt: Date | null;
  expiresAt: Date | null;
  totalValue: number | null;
  paymentTerms: string | null;
  cancellationPolicy: string | null;
  includedItems: string | null;
  excludedItems: string | null;
  notes: string | null;
  attachments?: ContractAttachment[];
};
type Attachment = {
  id: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date | string;
  contractId: string | null;
};
type BudgetItem = {
  id: string;
  title: string;
  estimatedValue: number;
  actualValue: number | null;
};
type Payment = {
  id: string;
  amount: number;
  dueDate: Date;
  status: string;
  method: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
};

type VendorFull = VendorBase & {
  budgetItems: BudgetItem[];
  payments: Payment[];
  contacts: Contact[];
  vendorNotes: Note[];
  contracts: Contract[];
  attachments: Attachment[];
};

const CONTRACT_STATUS_KEYS = [
  "DRAFT",
  "SENT",
  "NEGOTIATING",
  "SIGNED_DIGITAL",
  "SIGNED_PHYSICAL",
  "CANCELLED",
] as const;

const NOTE_KIND_KEYS = ["NOTE", "NEGOTIATION_EVENT", "MEETING", "DECISION"] as const;

export default function VendorDetailClient({
  vendor,
  role,
}: {
  vendor: VendorFull;
  role?: string | null;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const budgetTotal = vendor.budgetItems.reduce(
    (s, b) => s + (b.actualValue ?? b.estimatedValue),
    0,
  );
  const paidTotal = vendor.payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);
  const balance = budgetTotal - paidTotal;

  return (
    <div className="space-y-6">
      <Header vendor={vendor} budgetTotal={budgetTotal} paidTotal={paidTotal} balance={balance} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ContactsSection vendor={vendor} startTransition={startTransition} toast={toast} />
        <NotesSection vendor={vendor} startTransition={startTransition} toast={toast} />
      </div>

      <ContractsSection vendor={vendor} role={role ?? null} startTransition={startTransition} toast={toast} />
      <AttachmentsSection vendor={vendor} startTransition={startTransition} toast={toast} />
      <PaymentsSection vendor={vendor} />
    </div>
  );
}

function Header({
  vendor,
  budgetTotal,
  paidTotal,
  balance,
}: {
  vendor: VendorFull;
  budgetTotal: number;
  paidTotal: number;
  balance: number;
}) {
  const t = useTranslations("dashboard.vendors.detail");
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider text-zinc-500">{vendor.category}</span>
          <h1 className="mt-1 text-2xl font-bold text-white">{vendor.name}</h1>
          {vendor.indicatedBy ? (
            <p className="mt-1 text-xs text-zinc-500">{t("header.indicatedBy", { name: vendor.indicatedBy })}</p>
          ) : null}
          {vendor.tags ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {vendor.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-300"
                  >
                    {t}
                  </span>
                ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          {vendor.rating ? (
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < (vendor.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-zinc-700"}`}
                />
              ))}
            </div>
          ) : null}
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              vendor.status === "CONTRACTED"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : vendor.status === "FINALIZED"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            {vendor.status === "CONTRACTED" ? t("status.contracted") : vendor.status === "FINALIZED" ? t("status.finalized") : t("status.negotiation")}
          </span>
          {vendor.contractLink ? (
            <a
              href={vendor.contractLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {t("header.contractLink")}
            </a>
          ) : null}
        </div>
      </div>

      {vendor.notes ? (
        <p className="mt-4 whitespace-pre-line rounded-xl bg-zinc-950/60 p-3 text-sm text-zinc-300">
          {vendor.notes}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("header.budgeted")} value={budgetTotal} accent="zinc" />
        <Stat label={t("header.paid")} value={paidTotal} accent="emerald" />
        <Stat label={t("header.balance")} value={balance} accent={balance > 0 ? "rose" : "emerald"} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "zinc" | "rose" | "emerald";
}) {
  const accentClass =
    accent === "rose" ? "text-rose-400" : accent === "emerald" ? "text-emerald-400" : "text-zinc-200";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accentClass}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function ContactsSection({
  vendor,
  startTransition,
  toast,
}: {
  vendor: VendorFull;
  startTransition: React.TransitionStartFunction;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.vendors.detail");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createVendorContact(undefined, formData);
        if (r.success) {
          toast.success(t("contacts.added"));
          setOpen(false);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    startTransition(async () => {
      const r = await deleteVendorContact(id, vendor.id);
      if (r.success) {
        toast.success(t("contacts.removed"));
        setDeleteId(null);
      } else toast.error(t("toast.failed"), r.error);
    });
  }

  return (
    <Card title={t("contacts.title")} icon={<Users className="h-5 w-5" />} action={() => setOpen(true)}>
      {vendor.contacts.length === 0 ? (
        <Empty text={t("contacts.empty")} />
      ) : (
        <ul className="space-y-2">
          {vendor.contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-200">{c.name}</span>
                  {c.isPrimary ? (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                      {t("contacts.primary")}
                    </span>
                  ) : null}
                </div>
                {c.role ? <p className="text-xs text-zinc-500">{c.role}</p> : null}
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-400">
                  {c.phone ? (
                    <a
                      href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-emerald-400"
                    >
                      <Phone className="h-3 w-3" /> {c.phone}
                    </a>
                  ) : null}
                  {c.email ? <span>{c.email}</span> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteId(c.id)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
                aria-label={t("contacts.deleteAria")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">{t("contacts.formTitle")}</h2>
            <form action={handleSubmit} className="mt-4 space-y-3">
              <input type="hidden" name="vendorId" value={vendor.id} />
              <Input name="name" label={t("contacts.name")} required />
              <Input name="role" label={t("contacts.role")} />
              <Input name="phone" label={tc("labels.phone")} placeholder="+5511..." />
              <Input name="email" label={tc("labels.email")} type="email" />
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" name="isPrimary" className="accent-rose-500" /> {t("contacts.isPrimary")}
              </label>
              <ModalActions onCancel={() => setOpen(false)} busy={busy} />
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteId}
        title={t("contacts.removeTitle")}
        confirmLabel={tc("actions.remove")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Card>
  );
}

function NotesSection({
  vendor,
  startTransition,
  toast,
}: {
  vendor: VendorFull;
  startTransition: React.TransitionStartFunction;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.vendors.detail");
  const tc = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createVendorNote(undefined, formData);
        if (r.success) {
          toast.success(t("notes.added"));
          const form = document.getElementById(`note-form-${vendor.id}`) as HTMLFormElement | null;
          form?.reset();
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    startTransition(async () => {
      const r = await deleteVendorNote(id, vendor.id);
      if (r.success) {
        toast.success(t("notes.removed"));
        setDeleteId(null);
      } else toast.error(t("toast.failed"), r.error);
    });
  }

  return (
    <Card title={t("notes.title")} icon={<MessageSquare className="h-5 w-5" />}>
      <form id={`note-form-${vendor.id}`} action={handleSubmit} className="mb-4 space-y-2">
        <input type="hidden" name="vendorId" value={vendor.id} />
        <div className="flex gap-2">
          <select
            name="kind"
            defaultValue="NOTE"
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
          >
            <option value="NOTE">{t("noteKind.NOTE")}</option>
            <option value="NEGOTIATION_EVENT">{t("noteKind.NEGOTIATION_EVENT")}</option>
            <option value="MEETING">{t("noteKind.MEETING")}</option>
            <option value="DECISION">{t("noteKind.DECISION")}</option>
          </select>
        </div>
        <textarea
          name="body"
          rows={2}
          required
          maxLength={4000}
          placeholder={t("notes.bodyPlaceholder")}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span>{t("notes.add")}</span>
        </button>
      </form>

      {vendor.vendorNotes.length === 0 ? (
        <Empty text={t("notes.empty")} />
      ) : (
        <ul className="space-y-2">
          {vendor.vendorNotes.map((n) => (
            <li key={n.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {(NOTE_KIND_KEYS as readonly string[]).includes(n.kind) ? t(`noteKind.${n.kind}`) : n.kind}
                    </span>
                    <span className="text-[11px] text-zinc-500">{formatDateTimeBR(n.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-zinc-200">{n.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteId(n.id)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                  aria-label={t("notes.deleteAria")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title={t("notes.removeTitle")}
        confirmLabel={tc("actions.remove")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Card>
  );
}

function ContractsSection({
  vendor,
  role,
  startTransition,
  toast,
}: {
  vendor: VendorFull;
  role: string | null;
  startTransition: React.TransitionStartFunction;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.vendors.detail");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const canView = canViewContract(role);
  const canUpload = canUploadContract(role);
  const canSign = canSignContract(role);

  function handleSubmit(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createContract(undefined, formData);
        if (r.success) {
          toast.success(t("contracts.created"));
          setOpen(false);
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    startTransition(async () => {
      const r = await deleteContract(id, vendor.id);
      if (r.success) {
        toast.success(t("contracts.removed"));
        setDeleteId(null);
      } else toast.error(t("toast.failed"), r.error);
    });
  }

  return (
    <Card title={t("contracts.title")} icon={<FileText className="h-5 w-5" />} action={() => setOpen(true)}>
      {vendor.contracts.length === 0 ? (
        <Empty text={t("contracts.empty")} />
      ) : (
        <ul className="space-y-3">
          {vendor.contracts.map((c) => (
            <li key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-zinc-100">{c.title}</h4>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">v{c.version}</span>
                    <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-300">
                      {(CONTRACT_STATUS_KEYS as readonly string[]).includes(c.status) ? t(`contractStatus.${c.status}`) : c.status}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {c.totalValue ? <Mini label={t("contracts.value")} value={formatCurrency(c.totalValue)} /> : null}
                    {c.signedAt ? <Mini label={t("contracts.signed")} value={formatDateBR(c.signedAt)} /> : null}
                    {c.expiresAt ? <Mini label={t("contracts.expires")} value={formatDateBR(c.expiresAt)} /> : null}
                  </div>
                  {c.paymentTerms ? <MiniBlock label={t("contracts.paymentTerms")} body={c.paymentTerms} /> : null}
                  {c.cancellationPolicy ? (
                    <MiniBlock label={t("contracts.cancellationPolicy")} body={c.cancellationPolicy} />
                  ) : null}
                  {c.includedItems ? <MiniBlock label={t("contracts.included")} body={c.includedItems} /> : null}
                  {c.excludedItems ? <MiniBlock label={t("contracts.excluded")} body={c.excludedItems} /> : null}
                  {c.notes ? <MiniBlock label={t("contracts.notes")} body={c.notes} /> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteId(c.id)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
                  aria-label={t("contracts.deleteAria")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <ContractFileBlock
                contract={c}
                vendorId={vendor.id}
                canView={canView}
                canUpload={canUpload}
                canSign={canSign}
                startTransition={startTransition}
                toast={toast}
              />
            </li>
          ))}
        </ul>
      )}

      {open ? <ContractForm vendorId={vendor.id} busy={busy} onClose={() => setOpen(false)} onSubmit={handleSubmit} /> : null}

      <ConfirmDialog
        open={!!deleteId}
        title={t("contracts.removeTitle")}
        description={t("contracts.removeDescription")}
        confirmLabel={tc("actions.delete")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Card>
  );
}

function ContractForm({
  vendorId,
  busy,
  onClose,
  onSubmit,
}: {
  vendorId: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const t = useTranslations("dashboard.vendors.detail");
  const tc = useTranslations("common");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">{t("contractForm.title")}</h2>
        <form action={onSubmit} className="mt-4 space-y-3">
          <input type="hidden" name="vendorId" value={vendorId} />
          <Input name="title" label={t("contractForm.titleLabel")} placeholder={t("contractForm.titlePlaceholder")} required />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">{tc("labels.status")}</label>
              <select
                name="status"
                defaultValue="DRAFT"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                {CONTRACT_STATUS_KEYS.map((k) => (
                  <option key={k} value={k}>{t(`contractStatus.${k}`)}</option>
                ))}
              </select>
            </div>
            <Input name="totalValue" type="number" step="0.01" label={t("contractForm.totalValue")} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input name="signedAt" type="date" label={t("contractForm.signedAt")} />
            <Input name="expiresAt" type="date" label={t("contractForm.expiresAt")} />
          </div>
          <Textarea name="paymentTerms" label={t("contracts.paymentTerms")} rows={2} />
          <Textarea name="cancellationPolicy" label={t("contracts.cancellationPolicy")} rows={2} />
          <Textarea name="includedItems" label={t("contractForm.includedItems")} rows={2} />
          <Textarea name="excludedItems" label={t("contractForm.excludedItems")} rows={2} />
          <Textarea name="notes" label={t("contracts.notes")} rows={2} />
          <ModalActions onCancel={onClose} busy={busy} confirmLabel={t("contractForm.save")} />
        </form>
      </div>
    </div>
  );
}

function AttachmentsSection({
  vendor,
  startTransition,
  toast,
}: {
  vendor: VendorFull;
  startTransition: React.TransitionStartFunction;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.vendors.detail");
  const tc = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleUpload(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await uploadAttachment(undefined, formData);
        if (r.success) {
          toast.success(t("attachments.uploaded"));
          const form = document.getElementById(`upload-form-${vendor.id}`) as HTMLFormElement | null;
          form?.reset();
        } else toast.error(t("toast.failed"), r.error);
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
      } else toast.error(t("toast.failed"), r.error);
    });
  }

  return (
    <Card title={t("attachments.title")} icon={<Paperclip className="h-5 w-5" />}>
      <form id={`upload-form-${vendor.id}`} action={handleUpload} className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <input type="hidden" name="ownerType" value="VENDOR" />
        <input type="hidden" name="ownerId" value={vendor.id} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-400">{t("attachments.fileLabel")}</span>
          <input
            type="file"
            name="file"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1 file:text-zinc-100"
          />
        </label>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400">{t("attachments.kindLabel")}</label>
          <select
            name="kind"
            defaultValue="CONTRACT"
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
          >
            <option value="CONTRACT">{t("attachmentKind.CONTRACT")}</option>
            <option value="PROPOSAL">{t("attachmentKind.PROPOSAL")}</option>
            <option value="RECEIPT">{t("attachmentKind.RECEIPT")}</option>
            <option value="INVOICE">{t("attachmentKind.INVOICE")}</option>
            <option value="ID_DOC">{t("attachmentKind.ID_DOC")}</option>
            <option value="PHOTO">{t("attachmentKind.PHOTO")}</option>
            <option value="OTHER">{t("attachmentKind.OTHER")}</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{t("attachments.send")}</span>
        </button>
      </form>

      {vendor.attachments.length === 0 ? (
        <Empty text={t("attachments.empty")} />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {vendor.attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2">
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
                  {a.kind} · {(a.size / 1024).toFixed(1)} KB · {formatDateBR(a.createdAt)}
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
        title={t("attachments.removeTitle")}
        confirmLabel={tc("actions.delete")}
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Card>
  );
}

function PaymentsSection({ vendor }: { vendor: VendorFull }) {
  const t = useTranslations("dashboard.vendors.detail");
  return (
    <Card title={t("payments.title")} icon={<CheckCircle2 className="h-5 w-5" />}>
      {vendor.payments.length === 0 ? (
        <Empty text={t("payments.empty")} />
      ) : (
        <ul className="divide-y divide-zinc-800/60">
          {vendor.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-zinc-200">
                  {formatDateBR(p.dueDate)}{" "}
                  <span className="text-xs text-zinc-500">
                    {p.method}
                    {p.installmentNumber && p.totalInstallments
                      ? ` · ${p.installmentNumber}/${p.totalInstallments}`
                      : ""}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-rose-300">{formatCurrency(p.amount)}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    p.status === "PAID"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}
                >
                  {p.status === "PAID" ? t("payments.paid") : t("payments.pending")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200"
        >
          {t("payments.manage")}
        </Link>
      </div>
    </Card>
  );
}

function Card({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: () => void;
  children: React.ReactNode;
}) {
  const tc = useTranslations("common");
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-100">
          {icon}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        {action ? (
          <button
            type="button"
            onClick={action}
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-800/70 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            <Plus className="h-3.5 w-3.5" /> {tc("actions.add")}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
      <AlertCircle className="h-4 w-4" />
      <span>{text}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}

function MiniBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-zinc-300">{body}</p>
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

function Textarea({
  name,
  label,
  rows = 3,
}: {
  name: string;
  label: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <textarea
        name={name}
        rows={rows}
        maxLength={4000}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

function ModalActions({
  onCancel,
  busy,
  confirmLabel,
}: {
  onCancel: () => void;
  busy: boolean;
  confirmLabel?: string;
}) {
  const tc = useTranslations("common");
  const label = confirmLabel ?? tc("actions.save");
  return (
    <div className="flex gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-xl bg-zinc-800 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        {tc("actions.cancel")}
      </button>
      <button
        type="submit"
        disabled={busy}
        className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
      </button>
    </div>
  );
}

function ContractFileBlock({
  contract,
  vendorId,
  canView,
  canUpload,
  canSign,
  startTransition,
  toast,
}: {
  contract: Contract;
  vendorId: string;
  canView: boolean;
  canUpload: boolean;
  canSign: boolean;
  startTransition: React.TransitionStartFunction;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useTranslations("dashboard.vendors.detail");
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState<FormData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [signing, setSigning] = useState(false);

  const all = contract.attachments ?? [];
  const current = all.find((a) => !a.deletedAt) ?? null;
  const history = all.filter((a) => a.id !== current?.id);
  const isSigned = contract.status === "SIGNED_DIGITAL" || contract.status === "SIGNED_PHYSICAL";

  if (!canView) {
    return (
      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 text-xs text-zinc-500">
        {t("contractFile.noViewPermission")}
      </div>
    );
  }

  function doUpload(fd: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await replaceContractFile(undefined, fd);
        if (r.success) {
          if (current) {
            toast.success(t("contractFile.updated"), t("contractFile.newVersionToast", { version: contract.version + 1 }));
          } else {
            toast.success(t("contractFile.pdfSent"), t("contractFile.keptVersionToast", { version: contract.version }));
          }
        } else toast.error(t("toast.failed"), r.error);
      } finally {
        setBusy(false);
        setConfirmReplace(null);
      }
    });
  }

  function submitReplace(formData: FormData) {
    if (!current) {
      doUpload(formData);
      return;
    }
    setConfirmReplace(formData);
  }

  function confirmDoReplace() {
    const fd = confirmReplace;
    if (!fd) return;
    doUpload(fd);
  }

  function handleSign(method: "DIGITAL" | "PHYSICAL") {
    setSigning(true);
    const fd = new FormData();
    fd.set("contractId", contract.id);
    fd.set("vendorId", vendorId);
    fd.set("method", method);
    startTransition(async () => {
      try {
        const r = await signContract(undefined, fd);
        if (r.success) toast.success(t("contractFile.signed"));
        else toast.error(t("toast.failed"), r.error);
      } finally {
        setSigning(false);
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h5 className="text-sm font-semibold text-zinc-200">{t("contractFile.title")}</h5>
        {current ? (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
            v{current.version}
          </span>
        ) : null}
      </div>

      {current ? (
        <div className="mt-3 space-y-3">
          <object
            data={`/api/files/${current.id}#toolbar=1&navpanes=0`}
            type="application/pdf"
            className="h-[500px] w-full rounded-lg border border-zinc-800 bg-zinc-900"
            aria-label={current.filename}
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-zinc-400">
              <p>{t("contractFile.inlineFallback")}</p>
              <a
                href={`/api/files/${current.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-rose-300 hover:text-rose-200"
              >
                {t("contractFile.openNewTab")}
              </a>
            </div>
          </object>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
            <span>
              {current.filename} ·{" "}
              {(current.size / 1024).toFixed(1)} KB
              {current.sha256Full ? ` · ${current.sha256Full.slice(0, 10)}…` : ""}
            </span>
            <span>
              {t("contractFile.uploadedAt", { date: formatDateBR(new Date(current.createdAt)) })}{" "}
              {current.uploadedBy ? t("contractFile.uploadedBy", { name: current.uploadedBy.name ?? current.uploadedBy.email }) : ""}
            </span>
          </div>
          <a
            href={`/api/files/${current.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-rose-300 hover:text-rose-200"
          >
            {t("contractFile.downloadPdf")}
          </a>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">{t("contractFile.noPdfYet")}</p>
      )}

      {canUpload ? (
        <form
          action={submitReplace}
          className="mt-4 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <input type="hidden" name="contractId" value={contract.id} />
          <input type="hidden" name="vendorId" value={vendorId} />
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              {current ? t("contractFile.replaceLabel", { version: contract.version + 1 }) : t("contractFile.uploadLabel")}
            </label>
            <input
              type="file"
              name="file"
              accept="application/pdf"
              required
              className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200 hover:file:bg-zinc-700"
            />
            <p className="mt-1 text-[10px] text-zinc-500">{t("contractFile.onlyPdf")}</p>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("contractFile.send")}
          </button>
        </form>
      ) : null}

      {canSign && !isSigned ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <span className="text-xs text-zinc-400">{t("contractFile.markSigned")}</span>
          <button
            type="button"
            disabled={signing}
            onClick={() => handleSign("DIGITAL")}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {t("contractFile.signDigital")}
          </button>
          <button
            type="button"
            disabled={signing}
            onClick={() => handleSign("PHYSICAL")}
            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-300 hover:bg-violet-500/20 disabled:opacity-50"
          >
            {t("contractFile.signPhysical")}
          </button>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            {showHistory
              ? t("contractFile.historyHide", { count: history.length })
              : t("contractFile.historyShow", { count: history.length })}
          </button>
          {showHistory ? (
            <ul className="mt-2 space-y-1">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 p-2 text-xs text-zinc-400"
                >
                  <span>
                    v{h.version} · {h.filename} · {(h.size / 1024).toFixed(1)} KB ·{" "}
                    {formatDateBR(new Date(h.createdAt))}
                  </span>
                  <a
                    href={`/api/files/${h.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-300 hover:text-rose-200"
                  >
                    {t("contractFile.download")}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={!!confirmReplace}
        title={t("contractFile.newVersionTitle", { version: contract.version + 1 })}
        description={t("contractFile.newVersionDescription")}
        confirmLabel={t("contractFile.confirmReplace")}
        tone="danger"
        onConfirm={confirmDoReplace}
        onCancel={() => setConfirmReplace(null)}
      />
    </div>
  );
}

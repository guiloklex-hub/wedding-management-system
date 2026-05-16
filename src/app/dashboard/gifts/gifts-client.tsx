"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Gift as GiftIcon, Heart, Loader2, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import {
  createGift,
  deleteGift,
  markGiftThanked,
  updateGift,
} from "@/app/actions/giftActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  notes: string | null;
  guest: { id: string; name: string } | null;
};

type GuestRef = { id: string; name: string };

export default function GiftsClient({ gifts, guests }: { gifts: GiftRow[]; guests: GuestRef[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GiftRow | null>(null);
  const [deleting, setDeleting] = useState<GiftRow | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDING_THANK">("ALL");
  const [busy, setBusy] = useState(false);
  const [updatingBusy, setUpdatingBusy] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (filter === "PENDING_THANK") return gifts.filter((g) => g.status !== "THANKED");
    return gifts;
  }, [gifts, filter]);

  const totals = useMemo(() => {
    const cash = gifts.filter((g) => g.type === "CASH").reduce((s, g) => s + (g.amount ?? 0), 0);
    const items = gifts.filter((g) => g.type === "ITEM").length;
    const pending = gifts.filter((g) => g.status !== "THANKED").length;
    return { cash, items, pending };
  }, [gifts]);

  function handleCreate(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createGift(undefined, formData);
        if (r.success) {
          toast.success("Presente registrado");
          setOpen(false);
        } else toast.error("Falha", r.error);
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
          toast.success("Presente atualizado");
          setEditing(null);
        } else toast.error("Falha", r.error);
      } finally {
        setUpdatingBusy(false);
      }
    });
  }
  function handleThanked(g: GiftRow) {
    startTransition(async () => {
      const r = await markGiftThanked(g.id, g.status !== "THANKED");
      if (r.success) toast.success(g.status === "THANKED" ? "Desmarcado" : "Marcado como agradecido");
      else toast.error("Falha", r.error);
    });
  }
  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const r = await deleteGift(id);
      if (r.success) {
        toast.success("Presente removido");
        setDeleting(null);
      } else toast.error("Falha", r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total em dinheiro" value={formatCurrency(totals.cash)} accent="emerald" />
        <StatCard label="Itens recebidos" value={String(totals.items)} />
        <StatCard label="Aguardando agradecer" value={String(totals.pending)} accent="amber" />
      </div>

      <div className="flex items-center justify-between">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
        >
          <option value="ALL">Todos</option>
          <option value="PENDING_THANK">Aguardando agradecer</option>
        </select>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" /> Novo presente
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          Nenhum presente registrado.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((g) => (
            <li key={g.id} className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:flex-row sm:items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                <GiftIcon className={`h-4 w-4 ${g.type === "CASH" ? "text-emerald-400" : "text-sky-400"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-100">
                    {g.guest?.name ?? g.giverName ?? "Anônimo"}
                  </span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                    {g.type === "CASH" ? "Dinheiro" : "Item"}
                  </span>
                  {g.status === "THANKED" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Agradecido
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
                          <Heart className="h-2.5 w-2.5" /> lua de mel
                        </span>
                      ) : null}
                      {g.pixPaidAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          Pix recebido
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center gap-1">
                  {g.type === "CASH" ? (
                    <Link
                      href={`/dashboard/gifts/${g.id}/pix`}
                      aria-label="Gerar QR Pix"
                      title="Gerar QR Pix"
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
                    aria-label="Alternar agradecimento"
                    title={g.status === "THANKED" ? "Desmarcar agradecido" : "Marcar como agradecido"}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(g)}
                    aria-label="Editar"
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(g)}
                    aria-label="Excluir"
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

      <ConfirmDialog
        open={!!deleting}
        title="Excluir presente?"
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
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
  const [type, setType] = useState(gift?.type ?? "CASH");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm">
      <div className="my-8 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white">
          {mode === "create" ? "Novo presente" : "Editar presente"}
        </h2>
        <form action={formAction} className="mt-4 space-y-3">
          {gift ? <input type="hidden" name="id" value={gift.id} /> : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Tipo</label>
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              <option value="CASH">Dinheiro</option>
              <option value="ITEM">Item</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Convidado (opcional)</label>
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
          <Field name="giverName" label="Nome de quem deu (se não tiver convidado)" defaultValue={gift?.giverName ?? ""} />
          {type === "CASH" ? (
            <Field name="amount" label="Valor (R$)" type="number" step="0.01" defaultValue={gift?.amount?.toString() ?? ""} />
          ) : (
            <Field
              name="description"
              label="Descrição"
              defaultValue={gift?.description ?? ""}
            />
          )}
          <Field
            name="receivedAt"
            label="Recebido em"
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
              Cota da lua de mel (mostrar QR Pix dedicado)
            </label>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Notas</label>
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
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="flex flex-1 items-center justify-center rounded-xl bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
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

"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ExternalLink,
  Gift,
  Loader2,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import {
  createTrousseauItem,
  deleteTrousseauItem,
  setTrousseauStatus,
  updateTrousseauItem,
} from "@/app/actions/trousseauActions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency } from "@/lib/format";

type Item = {
  id: string;
  title: string;
  room: string;
  priority: string;
  status: string;
  estimatedPrice: number | null;
  actualPrice: number | null;
  store: string | null;
  link: string | null;
  notes: string | null;
};

const ROOM_LABEL: Record<string, string> = {
  KITCHEN: "Cozinha",
  BATHROOM: "Banheiro",
  BEDROOM: "Quarto",
  LIVING: "Sala",
  LAUNDRY: "Lavanderia",
  ELECTRONICS: "Eletro",
  OTHER: "Outros",
};

const PRIORITY_LABEL: Record<string, { label: string; chip: string; weight: number }> = {
  ESSENTIAL: { label: "Essencial", chip: "bg-rose-500/15 text-rose-300", weight: 1 },
  NICE_TO_HAVE: { label: "Desejável", chip: "bg-amber-500/10 text-amber-300", weight: 2 },
  LUXURY: { label: "Luxo", chip: "bg-zinc-800 text-zinc-300", weight: 3 },
};

const STATUS_LABEL: Record<string, string> = {
  TO_BUY: "A comprar",
  BOUGHT: "Comprado",
  GIFTED: "Ganhei",
};

export default function TrousseauClient({ items }: { items: Item[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [filter, setFilter] = useState<"ALL" | "TO_BUY" | "BOUGHT" | "GIFTED">("ALL");
  const [busy, setBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const totals = useMemo(() => {
    const estTotal = items.reduce((s, i) => s + (i.estimatedPrice ?? 0), 0);
    const actualTotal = items.reduce((s, i) => s + (i.actualPrice ?? 0), 0);
    const toBuy = items.filter((i) => i.status === "TO_BUY").length;
    const bought = items.filter((i) => i.status === "BOUGHT").length;
    const gifted = items.filter((i) => i.status === "GIFTED").length;
    return { estTotal, actualTotal, toBuy, bought, gifted };
  }, [items]);

  function handleCreate(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await createTrousseauItem(undefined, formData);
        if (r.success) {
          toast.success("Item adicionado");
          setOpen(false);
        } else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }
  function handleUpdate(formData: FormData) {
    setUpdateBusy(true);
    startTransition(async () => {
      try {
        const r = await updateTrousseauItem(undefined, formData);
        if (r.success) {
          toast.success("Item atualizado");
          setEditing(null);
        } else toast.error("Falha", r.error);
      } finally {
        setUpdateBusy(false);
      }
    });
  }
  function handleStatus(it: Item, status: "TO_BUY" | "BOUGHT" | "GIFTED") {
    startTransition(async () => {
      const r = await setTrousseauStatus(it.id, status);
      if (!r.success) toast.error("Falha", r.error);
    });
  }
  function handleDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const r = await deleteTrousseauItem(id);
      if (r.success) {
        toast.success("Item removido");
        setDeleting(null);
      } else toast.error("Falha", r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat label="Estimado" value={formatCurrency(totals.estTotal)} />
        <Stat label="Comprado" value={formatCurrency(totals.actualTotal)} accent="emerald" />
        <Stat label="A comprar" value={String(totals.toBuy)} accent="amber" />
        <Stat label="Ganhei" value={String(totals.gifted)} accent="emerald" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
        >
          <option value="ALL">Todos</option>
          <option value="TO_BUY">A comprar</option>
          <option value="BOUGHT">Comprado</option>
          <option value="GIFTED">Ganhei</option>
        </select>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          <Plus className="h-4 w-4" /> Novo item
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          Nada por aqui ainda.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((it) => {
            const prio = PRIORITY_LABEL[it.priority] ?? PRIORITY_LABEL.NICE_TO_HAVE;
            return (
              <article
                key={it.id}
                className={`rounded-2xl border bg-zinc-900/50 p-4 ${
                  it.status === "BOUGHT" || it.status === "GIFTED" ? "border-zinc-800 opacity-80" : "border-zinc-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`font-medium ${it.status !== "TO_BUY" ? "text-zinc-400 line-through" : "text-zinc-100"}`}>
                        {it.title}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${prio.chip}`}>
                        {prio.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {ROOM_LABEL[it.room] ?? it.room}
                      {it.store ? ` · ${it.store}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-zinc-300">
                      {it.estimatedPrice ? formatCurrency(it.estimatedPrice) : "—"}
                      {it.actualPrice ? (
                        <span className="ml-2 text-emerald-300">
                          (pago: {formatCurrency(it.actualPrice)})
                        </span>
                      ) : null}
                    </p>
                    {it.link ? (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200"
                      >
                        <ExternalLink className="h-3 w-3" /> Link da loja
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300">
                      {STATUS_LABEL[it.status]}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleStatus(it, it.status === "BOUGHT" ? "TO_BUY" : "BOUGHT")}
                        aria-label="Alternar comprado"
                        className={`rounded-lg p-1.5 ${
                          it.status === "BOUGHT"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700"
                        }`}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatus(it, it.status === "GIFTED" ? "TO_BUY" : "GIFTED")}
                        aria-label="Ganhei"
                        className={`rounded-lg p-1.5 ${
                          it.status === "GIFTED"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700"
                        }`}
                      >
                        <Gift className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(it)}
                        aria-label="Editar"
                        className="rounded-lg bg-zinc-800/70 p-1.5 text-zinc-300 hover:bg-zinc-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(it)}
                        aria-label="Excluir"
                        className="rounded-lg bg-zinc-800/70 p-1.5 text-rose-400 hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {(open || editing) && (
        <ItemModal
          mode={editing ? "edit" : "create"}
          item={editing ?? undefined}
          isBusy={editing ? updateBusy : busy}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          formAction={editing ? handleUpdate : handleCreate}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Excluir item?"
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function Stat({
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
      <p className={`mt-1 text-xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}

function ItemModal({
  mode,
  item,
  isBusy,
  onClose,
  formAction,
}: {
  mode: "create" | "edit";
  item?: Item;
  isBusy: boolean;
  onClose: () => void;
  formAction: (formData: FormData) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="my-4 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">
          {mode === "create" ? "Novo item do enxoval" : "Editar item"}
        </h2>
        <form action={formAction} className="mt-4 space-y-3">
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <Field name="title" label="Item" required defaultValue={item?.title ?? ""} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Cômodo</label>
              <select
                name="room"
                defaultValue={item?.room ?? "OTHER"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                {Object.entries(ROOM_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">Prioridade</label>
              <select
                name="priority"
                defaultValue={item?.priority ?? "NICE_TO_HAVE"}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field name="estimatedPrice" label="Preço estimado" type="number" step="0.01" defaultValue={item?.estimatedPrice?.toString() ?? ""} />
            <Field name="actualPrice" label="Preço pago" type="number" step="0.01" defaultValue={item?.actualPrice?.toString() ?? ""} />
          </div>
          <Field name="store" label="Loja" defaultValue={item?.store ?? ""} />
          <Field name="link" label="Link" type="url" defaultValue={item?.link ?? ""} />
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Status</label>
            <select
              name="status"
              defaultValue={item?.status ?? "TO_BUY"}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">Notas</label>
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={item?.notes ?? ""}
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


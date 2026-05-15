"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CalendarHeart,
  CheckCircle2,
  CloudRain,
  Loader2,
  Phone,
  Save,
  Search,
} from "lucide-react";
import { toggleCheckin } from "@/app/actions/guestActions";
import { updateWeddingDay } from "@/app/actions/weddingDayActions";
import { useToast } from "@/components/toast";
import { formatCurrency, formatDateBR } from "@/lib/format";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  responsible: string | null;
};

type Payment = {
  id: string;
  amount: number;
  method: string | null;
  status: string;
  vendor: { name: string };
};

type Vendor = {
  id: string;
  name: string;
  category: string;
  contactName: string | null;
  contactPhone: string | null;
};

type Guest = {
  id: string;
  name: string;
  rsvpStatus: string;
  checkedInAt: Date | null;
  plusOnesConfirmed: number;
  isChild: boolean;
};

type Settings = {
  rainPlanB: string | null;
  daySchedule: string | null;
  daySpecialNotes: string | null;
} | null;

type Props = {
  eventDate: Date;
  daysToEvent: number;
  coupleNames: string | null;
  rainPlanB: string | null;
  daySchedule: string | null;
  daySpecialNotes: string | null;
  settings: Settings;
  tasksToday: Task[];
  paymentsToday: Payment[];
  criticalVendors: Vendor[];
  guestStats: Array<{ rsvpStatus: string; _count: { _all: number } }>;
  guests: Guest[];
};

export default function WeddingDayClient({
  eventDate,
  daysToEvent,
  coupleNames,
  settings,
  tasksToday,
  paymentsToday,
  criticalVendors,
  guestStats,
  guests,
}: Props) {
  const toast = useToast();
  const [editingSettings, setEditingSettings] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const confirmed = guestStats.find((s) => s.rsvpStatus === "CONFIRMED")?._count._all ?? 0;
  const total = guests.length;
  const checkedIn = guests.filter((g) => g.checkedInAt).length;
  const totalSeats = guests
    .filter((g) => g.rsvpStatus === "CONFIRMED")
    .reduce((s, g) => s + 1 + g.plusOnesConfirmed, 0);

  const filteredGuests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guests.filter((g) => g.rsvpStatus === "CONFIRMED");
    return guests.filter((g) => g.name.toLowerCase().includes(term));
  }, [guests, search]);

  function handleUpdateSettings(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await updateWeddingDay(undefined, formData);
        if (r.success) {
          toast.success("Salvo");
          setEditingSettings(false);
        } else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function handleCheckin(g: Guest) {
    startTransition(async () => {
      const r = await toggleCheckin(g.id, !g.checkedInAt);
      if (!r.success) toast.error("Falha", r.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-zinc-900/30 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-rose-200">
              <CalendarHeart className="h-5 w-5" />
              <span className="text-xs uppercase tracking-wider">Modo Dia do Casamento</span>
            </div>
            <h1 className="mt-1 text-3xl font-bold text-white">
              {coupleNames ?? "O grande dia"}
            </h1>
            <p className="mt-1 text-sm text-zinc-300">{formatDateBR(eventDate)}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-center">
            <p className="text-xs uppercase tracking-wider text-rose-200">Contagem regressiva</p>
            <p className="text-3xl font-bold text-rose-100">{daysToEvent} dia{daysToEvent === 1 ? "" : "s"}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Confirmados" value={`${confirmed}/${total}`} accent="emerald" />
        <Stat label="Total de cabeças" value={String(totalSeats)} />
        <Stat label="Chegaram" value={`${checkedIn}/${totalSeats}`} accent={checkedIn > 0 ? "emerald" : "amber"} />
        <Stat label="Tarefas do dia" value={String(tasksToday.length)} accent="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Cronograma do dia" icon={<CalendarHeart className="h-5 w-5" />}>
          <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-200">
            {settings?.daySchedule || "Nenhum cronograma adicionado. Use o botão abaixo para registrar (ex.: 07:00 cabeleireiro, 14:00 chegada do buffet...)."}
          </pre>
        </Card>

        <Card title="Plano B chuva / contingências" icon={<CloudRain className="h-5 w-5" />}>
          <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-200">
            {settings?.rainPlanB || "Sem plano B documentado."}
          </pre>
        </Card>
      </div>

      <Card title="Observações especiais" icon={<AlertTriangle className="h-5 w-5" />}>
        <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-200">
          {settings?.daySpecialNotes || "Sem observações."}
        </pre>
        <button
          type="button"
          onClick={() => setEditingSettings((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
        >
          {editingSettings ? "Fechar edição" : "Editar cronograma / plano B / observações"}
        </button>

        {editingSettings ? (
          <form action={handleUpdateSettings} className="mt-4 space-y-3">
            <FormTextarea
              label="Cronograma do dia"
              name="daySchedule"
              defaultValue={settings?.daySchedule ?? ""}
              rows={6}
              placeholder={`Ex:\n07:00 — cabeleireiro chega\n11:00 — fotógrafo making of\n16:30 — cerimônia\n...`}
            />
            <FormTextarea
              label="Plano B chuva / contingências"
              name="rainPlanB"
              defaultValue={settings?.rainPlanB ?? ""}
              rows={3}
            />
            <FormTextarea
              label="Observações especiais"
              name="daySpecialNotes"
              defaultValue={settings?.daySpecialNotes ?? ""}
              rows={3}
              placeholder="Música primeira dança, valsa, surpresa, sabores do bolo..."
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Salvar</span>
            </button>
          </form>
        ) : null}
      </Card>

      <Card title="Contatos críticos" icon={<Phone className="h-5 w-5" />}>
        {criticalVendors.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem fornecedores contratados.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {criticalVendors.map((v) => (
              <li key={v.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="font-medium text-zinc-100">{v.name}</p>
                <p className="text-xs text-zinc-500">{v.category}</p>
                {v.contactName ? <p className="mt-1 text-sm text-zinc-300">{v.contactName}</p> : null}
                {v.contactPhone ? (
                  <a
                    href={`https://wa.me/${v.contactPhone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
                  >
                    <Phone className="h-3.5 w-3.5" /> {v.contactPhone}
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-zinc-600">Sem contato cadastrado</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Tarefas do dia" icon={<CheckCircle2 className="h-5 w-5" />}>
        {tasksToday.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma tarefa marcada para hoje.</p>
        ) : (
          <ul className="space-y-2">
            {tasksToday.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"
              >
                <div>
                  <p className={`font-medium ${t.status === "DONE" ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
                    {t.title}
                  </p>
                  {t.responsible ? <p className="text-xs text-zinc-500">👤 {t.responsible}</p> : null}
                </div>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300">
                  {t.priority}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {paymentsToday.length > 0 ? (
        <Card title="Pagamentos do dia">
          <ul className="space-y-2">
            {paymentsToday.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"
              >
                <div>
                  <p className="font-medium text-zinc-100">{p.vendor.name}</p>
                  <p className="text-xs text-zinc-500">{p.method ?? "—"}</p>
                </div>
                <span className="text-base font-semibold text-rose-300">{formatCurrency(p.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Check-in rápido">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar convidado..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
          />
        </div>
        {filteredGuests.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum convidado.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {filteredGuests.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                <div>
                  <p className="font-medium text-zinc-100">{g.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {g.isChild ? "Criança · " : ""}
                    {g.plusOnesConfirmed > 0 ? `+${g.plusOnesConfirmed}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCheckin(g)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    g.checkedInAt
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {g.checkedInAt ? "Chegou" : "Marcar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-center gap-2 text-zinc-100">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </section>
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
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}

function FormTextarea({
  label,
  name,
  defaultValue,
  rows = 3,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-400">{label}</label>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={8000}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
    </div>
  );
}

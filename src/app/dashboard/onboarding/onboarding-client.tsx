"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarHeart,
  Check,
  HeartHandshake,
  Loader2,
  PartyPopper,
  PiggyBank,
  Sparkles,
} from "lucide-react";
import {
  finishOnboarding,
  saveBudgetStep,
  saveCoupleStep,
} from "@/app/actions/onboardingActions";
import { useToast } from "@/components/toast";

type Initial = {
  coupleNames: string;
  eventDate: string;
  currency: string;
  contingencyPercent: number;
};

type Step = 1 | 2 | 3 | 4;

const STEPS: Array<{ id: Step; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 1, title: "O casal", subtitle: "Nomes e data", icon: HeartHandshake },
  { id: 2, title: "Orçamento", subtitle: "Contingência", icon: PiggyBank },
  { id: 3, title: "Comunicações", subtitle: "Email & WhatsApp", icon: Sparkles },
  { id: 4, title: "Pronto", subtitle: "Resumo final", icon: PartyPopper },
];

export default function OnboardingClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const { update } = useSession();
  const toast = useToast();

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const [coupleNames, setCoupleNames] = useState(initial.coupleNames);
  const [eventDate, setEventDate] = useState(initial.eventDate);
  const [currency, setCurrency] = useState(initial.currency);
  const [contingency, setContingency] = useState(initial.contingencyPercent);

  function submitCouple(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await saveCoupleStep(undefined, formData);
        if (r.success) {
          toast.success("Dados do casal salvos");
          setStep(2);
        } else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function submitBudget(formData: FormData) {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await saveBudgetStep(undefined, formData);
        if (r.success) {
          toast.success("Orçamento configurado");
          setStep(3);
        } else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  function finish() {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await finishOnboarding();
        if (r.success) {
          await update({ onboardingCompleted: true });
          toast.success("Tudo pronto! Bom planejamento ✨");
          router.push("/dashboard");
          router.refresh();
        } else toast.error("Falha", r.error);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-500/30">
          <CalendarHeart className="h-7 w-7 text-rose-300" />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
          Vamos preparar seu casamento
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Em poucos passos personalizamos o sistema para o seu grande dia.
        </p>
      </header>

      <Stepper current={step} />

      {step === 1 ? (
        <Card title="Quem são os noivos?" subtitle="Nome do casal, data e moeda que usaremos no orçamento.">
          <form action={submitCouple} className="space-y-4">
            <Field
              label="Nomes do casal"
              name="coupleNames"
              required
              defaultValue={coupleNames}
              onChange={(v) => setCoupleNames(v)}
              placeholder="Maria & João"
              hint="Aparece no dashboard, no convite de RSVP e nas notificações."
            />
            <Field
              label="Data do casamento"
              name="eventDate"
              type="date"
              required
              defaultValue={eventDate}
              onChange={(v) => setEventDate(v)}
              hint="Pode ser ajustada depois em Ajustes › Casamento."
            />
            <SelectField
              label="Moeda"
              name="currency"
              defaultValue={currency}
              onChange={(v) => setCurrency(v)}
              options={[
                { value: "BRL", label: "Real (BRL)" },
                { value: "USD", label: "Dólar (USD)" },
                { value: "EUR", label: "Euro (EUR)" },
              ]}
            />
            <Actions busy={busy} primary="Continuar" />
          </form>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card
          title="Quanto guardar de reserva?"
          subtitle="Recomendamos 10% sobre o valor contratado para imprevistos. Pode mudar depois."
        >
          <form action={submitBudget} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Fundo de contingência
                <span className="ml-2 text-rose-300">{contingency.toFixed(0)}%</span>
              </label>
              <input
                name="contingencyPercent"
                type="range"
                min={0}
                max={30}
                step={1}
                value={contingency}
                onChange={(e) => setContingency(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
              <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
                <span>0%</span>
                <span>15%</span>
                <span>30%</span>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
              💡 O fundo aparece como uma categoria extra no orçamento, ajudando a evitar surpresas como
              chuva, mudança de cardápio ou aumento de convidados.
            </div>
            <Actions
              busy={busy}
              primary="Continuar"
              secondary="Voltar"
              onSecondary={() => setStep(1)}
            />
          </form>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card
          title="Como prefere ser avisado?"
          subtitle="Você pode configurar email e WhatsApp depois, em Ajustes › WhatsApp e Ajustes › Casamento."
        >
          <div className="space-y-3 text-sm text-zinc-300">
            <p>
              ✉️ <strong>Email (SMTP)</strong> — para senhas, reset, lembretes de tarefas e
              pagamentos. Pode usar Gmail, Outlook, SendGrid, etc.
            </p>
            <p>
              💬 <strong>WhatsApp</strong> — envia os mesmos lembretes via WhatsApp Web (Baileys).
              É opcional. Após o setup, vá em Ajustes › WhatsApp e escaneie o QR Code.
            </p>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-200">
              👉 Vamos te levar direto ao painel. Em <strong>Ajustes › Casamento</strong> você ajusta
              SMTP e, em <strong>Ajustes › WhatsApp</strong>, conecta o número.
            </div>
          </div>
          <div className="mt-5">
            <Actions
              busy={busy}
              primary="Continuar"
              secondary="Voltar"
              onSecondary={() => setStep(2)}
              onPrimary={() => setStep(4)}
              primaryAsButton
            />
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card title="Tudo pronto!" subtitle="Confira o resumo. Clique em Concluir para ir ao painel.">
          <ul className="space-y-3 text-sm">
            <Summary label="Casal" value={coupleNames || "—"} />
            <Summary label="Data do casamento" value={formatDate(eventDate)} />
            <Summary label="Moeda" value={currency} />
            <Summary label="Contingência" value={`${contingency.toFixed(0)}%`} />
          </ul>
          <div className="mt-6">
            <Actions
              busy={busy}
              primary="Concluir e ir ao painel"
              primaryIcon={<Check className="h-4 w-4" />}
              secondary="Voltar"
              onSecondary={() => setStep(3)}
              onPrimary={finish}
              primaryAsButton
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  return (
    <ol className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
      {STEPS.map((s, idx) => {
        const Icon = s.icon;
        const done = current > s.id;
        const active = current === s.id;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                done
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : active
                    ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
                    : "border-zinc-700 bg-zinc-800/50 text-zinc-500"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <div className="hidden min-w-0 flex-1 sm:block">
              <p
                className={`truncate text-xs font-medium ${
                  active ? "text-zinc-100" : done ? "text-zinc-300" : "text-zinc-500"
                }`}
              >
                {s.title}
              </p>
              <p className="truncate text-[10px] text-zinc-500">{s.subtitle}</p>
            </div>
            {idx < STEPS.length - 1 ? (
              <div
                className={`h-px flex-1 ${done ? "bg-emerald-500/30" : "bg-zinc-800"}`}
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-300">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      />
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  onChange,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-300">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Actions({
  busy,
  primary,
  secondary,
  onSecondary,
  onPrimary,
  primaryAsButton,
  primaryIcon,
}: {
  busy: boolean;
  primary: string;
  secondary?: string;
  onSecondary?: () => void;
  onPrimary?: () => void;
  primaryAsButton?: boolean;
  primaryIcon?: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      {secondary ? (
        <button
          type="button"
          onClick={onSecondary}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {secondary}
        </button>
      ) : (
        <span />
      )}
      <button
        type={primaryAsButton ? "button" : "submit"}
        onClick={primaryAsButton ? onPrimary : undefined}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-rose-900/20 transition-colors hover:bg-rose-500 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : primaryIcon ?? <ArrowRight className="h-4 w-4" />}
        <span>{primary}</span>
      </button>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-100">{value}</span>
    </li>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

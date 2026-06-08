const MS_PER_DAY = 86_400_000;

export type ActionKind =
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DUE"
  | "TASK_OVERDUE"
  | "TASK_DUE"
  | "CONTRACT_EXPIRING"
  | "RSVP_PENDING"
  | "GIFT_THANK";

/**
 * Um item acionável do dashboard — algo concreto que o casal pode resolver
 * agora (pagar, fazer uma tarefa, cobrar RSVP, agradecer). Diferente do
 * risk-radar (que é agregado/preditivo), aqui cada linha aponta para uma ação.
 *
 * `params` carrega os valores crus para a UI montar o título traduzido
 * (`actionStream.kind.<KIND>`). Valores monetários ficam crus — a UI formata
 * com a moeda/locale do usuário.
 */
export type ActionItem = {
  id: string;
  kind: ActionKind;
  href: string;
  dueDate: Date | null;
  priority: number;
  finance: boolean;
  params: Record<string, string | number>;
};

export type ActionStreamPayment = {
  id: string;
  vendorName: string;
  amount: number;
  dueDate: Date;
  status: string;
};

export type ActionStreamTask = {
  id: string;
  title: string;
  priority: string;
  status: string;
  deadline: Date | null;
};

export type ActionStreamContract = {
  id: string;
  vendorName: string;
  status: string;
  expiresAt: Date | null;
};

export type ActionStreamInput = {
  today: Date;
  /** Janela (dias) para considerar um vencimento "próximo". Default 14. */
  dueSoonDays?: number;
  /** Janela (dias) para alertar contrato a expirar. Default 30. */
  contractExpiryDays?: number;
  payments: ActionStreamPayment[];
  tasks: ActionStreamTask[];
  contracts: ActionStreamContract[];
  /** Convidados ainda em INVITED (sem resposta). */
  rsvpPending: number;
  /** Presentes ainda sem agradecimento. */
  giftsPendingThank: number;
};

function daysFromTo(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function isHighPriority(priority: string): boolean {
  return priority === "HIGH" || priority === "URGENT";
}

/**
 * Agrega as fontes em uma lista priorizada de ações, ordenada por urgência
 * (atrasados primeiro, depois vencimentos próximos) e, em empate, pela data
 * mais próxima. Determinística e sem I/O — o caller carrega os dados e passa
 * `today`. A UI aplica o filtro de finanças por papel e o corte de exibição.
 */
export function aggregateActionStream(input: ActionStreamInput): ActionItem[] {
  const { today } = input;
  const dueSoonDays = input.dueSoonDays ?? 14;
  const contractExpiryDays = input.contractExpiryDays ?? 30;
  const items: ActionItem[] = [];

  for (const p of input.payments) {
    if (p.status !== "PENDING") continue;
    const days = daysFromTo(today, p.dueDate);
    if (days < 0) {
      const overdue = Math.min(-days, 365);
      items.push({
        id: `payment-overdue-${p.id}`,
        kind: "PAYMENT_OVERDUE",
        href: "/dashboard/payments?filter=overdue",
        dueDate: p.dueDate,
        priority: 1000 + overdue,
        finance: true,
        params: { vendor: p.vendorName, amount: p.amount, days: -days },
      });
    } else if (days <= dueSoonDays) {
      items.push({
        id: `payment-due-${p.id}`,
        kind: "PAYMENT_DUE",
        href: "/dashboard/payments",
        dueDate: p.dueDate,
        priority: 700 + (dueSoonDays - days),
        finance: true,
        params: { vendor: p.vendorName, amount: p.amount, days },
      });
    }
  }

  for (const tk of input.tasks) {
    if (tk.status === "DONE") continue;
    if (!tk.deadline) continue;
    const days = daysFromTo(today, tk.deadline);
    const bump = isHighPriority(tk.priority) ? 50 : 0;
    if (days < 0) {
      const overdue = Math.min(-days, 365);
      items.push({
        id: `task-overdue-${tk.id}`,
        kind: "TASK_OVERDUE",
        href: "/dashboard/tasks",
        dueDate: tk.deadline,
        priority: 900 + overdue + bump,
        finance: false,
        params: { title: tk.title, days: -days },
      });
    } else if (days <= dueSoonDays) {
      items.push({
        id: `task-due-${tk.id}`,
        kind: "TASK_DUE",
        href: "/dashboard/tasks",
        dueDate: tk.deadline,
        priority: 500 + (dueSoonDays - days) + bump,
        finance: false,
        params: { title: tk.title, days },
      });
    }
  }

  for (const c of input.contracts) {
    if (c.status === "SIGNED" || !c.expiresAt) continue;
    const days = daysFromTo(today, c.expiresAt);
    if (days < 0 || days > contractExpiryDays) continue;
    items.push({
      id: `contract-${c.id}`,
      kind: "CONTRACT_EXPIRING",
      href: "/dashboard/vendors",
      dueDate: c.expiresAt,
      priority: 600 + (contractExpiryDays - days),
      finance: true,
      params: { vendor: c.vendorName, days },
    });
  }

  if (input.rsvpPending > 0) {
    items.push({
      id: "rsvp-pending",
      kind: "RSVP_PENDING",
      href: "/dashboard/guests",
      dueDate: null,
      priority: 400,
      finance: false,
      params: { count: input.rsvpPending },
    });
  }

  if (input.giftsPendingThank > 0) {
    items.push({
      id: "gift-thank",
      kind: "GIFT_THANK",
      href: "/dashboard/gifts",
      dueDate: null,
      priority: 200,
      finance: false,
      params: { count: input.giftsPendingThank },
    });
  }

  items.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const da = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const db = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });

  return items;
}

import type { RiskAlert } from "./types";

type PaymentRow = {
  id: string;
  amount: number;
  dueDate: Date;
  paidAt: Date | null;
  status: string;
  vendor: { id: string; name: string } | null;
  lateFeePercent: number | null;
  interestPercentPerMonth: number | null;
};

type VendorBudgetRow = {
  id: string;
  name: string;
  status: string;
  budgetItems: Array<{ estimatedValue: number; actualValue: number | null }>;
};

type ContractRow = {
  id: string;
  vendorId: string;
  status: string;
  expiresAt: Date | null;
  vendor: { name: string };
};

type TaskRow = {
  id: string;
  title: string;
  priority: string;
  status: string;
  deadline: Date | null;
};

type CashflowPoint = { monthLabel: string; ending: number; isNegative: boolean };

export function computeRiskAlerts(input: {
  payments: PaymentRow[];
  vendors: VendorBudgetRow[];
  contracts: ContractRow[];
  tasks: TaskRow[];
  cashflow: CashflowPoint[];
  daysToEvent: number | null;
  today?: Date;
}): RiskAlert[] {
  const today = input.today ?? new Date();
  const alerts: RiskAlert[] = [];

  const overduePayments = input.payments.filter(
    (p) => p.status !== "PAID" && p.dueDate < today,
  );
  if (overduePayments.length > 0) {
    const total = overduePayments.reduce((s, p) => s + p.amount, 0);
    alerts.push({
      id: "overdue-payments",
      severity: "red",
      title: `${overduePayments.length} pagamento(s) vencido(s)`,
      body: `Soma de R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Possível incidência de juros e multas.`,
      href: "/dashboard/payments?filter=overdue",
      value: total,
      finance: true,
    });
  }

  const worstNeg = input.cashflow.find((c) => c.isNegative);
  if (worstNeg) {
    alerts.push({
      id: "negative-cashflow",
      severity: "red",
      title: "Projeção de caixa negativa",
      body: `O mês ${worstNeg.monthLabel} fecha em R$ ${worstNeg.ending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
      href: "/dashboard/insights",
      finance: true,
    });
  }

  const ninetyDays = new Date(today.getTime() + 90 * 86400000);
  const expiringContracts = input.contracts.filter(
    (c) =>
      ["DRAFT", "SENT", "NEGOTIATING"].includes(c.status) &&
      c.expiresAt &&
      c.expiresAt <= ninetyDays,
  );
  for (const c of expiringContracts) {
    const daysLeft = c.expiresAt
      ? Math.ceil((c.expiresAt.getTime() - today.getTime()) / 86400000)
      : 0;
    alerts.push({
      id: `contract-${c.id}`,
      severity: daysLeft <= 30 ? "red" : "amber",
      title: `Contrato sem assinatura: ${c.vendor.name}`,
      body: `Vence em ${daysLeft} dia(s) e está com status ${c.status}.`,
      href: `/dashboard/vendors/${c.vendorId}`,
      finance: false,
    });
  }

  for (const v of input.vendors) {
    const estimated = v.budgetItems.reduce((s, b) => s + b.estimatedValue, 0);
    const actual = v.budgetItems.reduce((s, b) => s + (b.actualValue ?? b.estimatedValue), 0);
    if (estimated > 0 && actual > estimated * 1.15) {
      alerts.push({
        id: `vendor-creep-${v.id}`,
        severity: actual > estimated * 1.3 ? "red" : "amber",
        title: `${v.name} estourou orçamento`,
        body: `Atual R$ ${actual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vs estimado R$ ${estimated.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${Math.round(((actual - estimated) / estimated) * 100)}%).`,
        href: `/dashboard/vendors/${v.id}`,
        value: actual - estimated,
        finance: true,
      });
    }
  }

  const urgentLate = input.tasks.filter(
    (t) =>
      t.priority === "URGENT" &&
      t.status !== "DONE" &&
      t.deadline &&
      t.deadline < today,
  );
  if (urgentLate.length > 0) {
    alerts.push({
      id: "urgent-tasks-late",
      severity: "red",
      title: `${urgentLate.length} tarefa(s) urgente(s) atrasada(s)`,
      body: urgentLate
        .slice(0, 3)
        .map((t) => t.title)
        .join(" · "),
      href: "/dashboard/tasks",
      finance: false,
    });
  }

  const highLate = input.tasks.filter(
    (t) =>
      t.priority === "HIGH" &&
      t.status !== "DONE" &&
      t.deadline &&
      t.deadline < today,
  );
  if (highLate.length > 0) {
    alerts.push({
      id: "high-tasks-late",
      severity: "amber",
      title: `${highLate.length} tarefa(s) de alta prioridade atrasada(s)`,
      body: highLate
        .slice(0, 3)
        .map((t) => t.title)
        .join(" · "),
      href: "/dashboard/tasks",
      finance: false,
    });
  }

  if (input.daysToEvent !== null && input.daysToEvent <= 30) {
    const pendingFinalize = input.vendors.filter((v) => v.status === "CONTRACTED");
    if (pendingFinalize.length > 0) {
      alerts.push({
        id: "vendors-not-finalized",
        severity: "amber",
        title: `${pendingFinalize.length} fornecedor(es) ainda não finalizado(s)`,
        body: "Próximo ao evento, confirme entregáveis e itens pendentes.",
        href: "/dashboard/vendors",
        finance: false,
      });
    }
  }

  const severityOrder: Record<string, number> = { red: 0, amber: 1, green: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return alerts;
}

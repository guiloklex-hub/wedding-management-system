export type MonthlyPoint = {
  month: string;
  monthLabel: string;
  starting: number;
  income: number;
  outflow: number;
  ending: number;
  isNegative: boolean;
};

type IncomeInput = {
  amount: number;
  expectedDate: Date | null;
  receivedAt: Date | null;
  status: string;
  frequency: string;
};

type PaymentInput = {
  amount: number;
  dueDate: Date;
  status: string;
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTHS_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function monthLabel(d: Date): string {
  return `${MONTHS_PT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
}

function monthsBetween(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor.getTime() <= limit.getTime()) {
    months.push(new Date(cursor.getTime()));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export function buildMonthlyCashflow(input: {
  startingCash: number;
  eventDate: Date;
  today?: Date;
  incomes: IncomeInput[];
  payments: PaymentInput[];
}): MonthlyPoint[] {
  const today = input.today ?? new Date();
  const months = monthsBetween(today, input.eventDate);

  const monthlyRecurring = input.incomes
    .filter((i) => i.status !== "CANCELLED" && i.frequency === "MONTHLY")
    .reduce((s, i) => s + i.amount, 0);

  const incomeByMonth = new Map<string, number>();
  for (const i of input.incomes) {
    if (i.status === "CANCELLED" || i.frequency === "MONTHLY") continue;
    const date = i.receivedAt ?? i.expectedDate;
    if (!date) continue;
    const key = monthKey(date);
    incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + i.amount);
  }

  const paymentByMonth = new Map<string, number>();
  for (const p of input.payments) {
    const key = monthKey(p.dueDate);
    paymentByMonth.set(key, (paymentByMonth.get(key) ?? 0) + p.amount);
  }

  let running = input.startingCash;
  const out: MonthlyPoint[] = [];
  for (const m of months) {
    const key = monthKey(m);
    const monthIncome = (incomeByMonth.get(key) ?? 0) + monthlyRecurring;
    const monthPayments = paymentByMonth.get(key) ?? 0;
    const ending = running + monthIncome - monthPayments;
    out.push({
      month: key,
      monthLabel: monthLabel(m),
      starting: running,
      income: monthIncome,
      outflow: monthPayments,
      ending,
      isNegative: ending < 0,
    });
    running = ending;
  }
  return out;
}

export type HealthScoreBreakdown = {
  label: string;
  weight: number;
  rawValue: number;
  normalized: number;
};

export type HealthScoreResult = {
  score: number;
  breakdown: HealthScoreBreakdown[];
  alerts: string[];
};

export function computeHealthScore(input: {
  totalBudget: number;
  totalContracted: number;
  totalPaid: number;
  totalCash: number;
  daysToEvent: number;
  totalTasks: number;
  tasksDone: number;
  tasksOverdue: number;
  worstMonthlyBalance: number;
}): HealthScoreResult {
  const budget = input.totalBudget;

  const contractedPct = budget > 0 ? Math.min(input.totalContracted / budget, 1) : 0;
  const paidPct = budget > 0 ? Math.min(input.totalPaid / budget, 1) : 0;
  const tasksPct = input.totalTasks > 0 ? input.tasksDone / input.totalTasks : 0;
  const overdueRatio = input.totalTasks > 0 ? input.tasksOverdue / input.totalTasks : 0;

  const cashCoverage =
    budget > 0 ? Math.min(input.totalCash / Math.max(budget - input.totalPaid, 1), 1) : 0;

  let expectedContractedPct = 1;
  if (input.daysToEvent > 365) expectedContractedPct = 0.3;
  else if (input.daysToEvent > 180) expectedContractedPct = 0.6;
  else if (input.daysToEvent > 90) expectedContractedPct = 0.85;
  else if (input.daysToEvent > 30) expectedContractedPct = 0.95;
  const onTrack = expectedContractedPct > 0 ? Math.min(contractedPct / expectedContractedPct, 1) : 1;

  const liquidity = input.worstMonthlyBalance >= 0 ? 1 : 0;

  const breakdown: HealthScoreBreakdown[] = [
    { label: "Cobertura contratada", weight: 0.25, rawValue: contractedPct, normalized: contractedPct },
    { label: "Adiantamento (% pago)", weight: 0.2, rawValue: paidPct, normalized: paidPct },
    { label: "Liquidez (sem mês no vermelho)", weight: 0.2, rawValue: input.worstMonthlyBalance, normalized: liquidity },
    { label: "Tarefas em dia", weight: 0.15, rawValue: tasksPct, normalized: Math.max(tasksPct - overdueRatio, 0) },
    { label: "No prazo (contratação x calendário)", weight: 0.1, rawValue: onTrack, normalized: onTrack },
    { label: "Cobertura de caixa", weight: 0.1, rawValue: cashCoverage, normalized: cashCoverage },
  ];

  const score = Math.round(
    breakdown.reduce((s, b) => s + b.normalized * b.weight, 0) * 100,
  );

  const alerts: string[] = [];
  if (liquidity === 0) alerts.push("Pelo menos um mês fica negativo na projeção atual.");
  if (overdueRatio > 0.1) alerts.push(`${Math.round(overdueRatio * 100)}% das tarefas estão atrasadas.`);
  if (contractedPct < expectedContractedPct - 0.15)
    alerts.push("Você está atrasado em fechar fornecedores para a distância do evento.");
  if (cashCoverage < 0.3 && budget - input.totalPaid > 0)
    alerts.push("Caixa cobre menos de 30% do saldo devedor.");

  return { score, breakdown, alerts };
}

export type CategoryCreep = {
  category: string;
  color: string;
  estimated: number;
  actual: number;
  delta: number;
  pct: number;
};

export function computeCategoryCreep(
  vendors: Array<{
    category: string;
    categoryKey: string | null;
    budgetItems: Array<{ estimatedValue: number; actualValue: number | null }>;
  }>,
  resolveColor: (key: string | null) => string,
  resolveLabel: (key: string | null, fallback: string) => string,
): CategoryCreep[] {
  const map = new Map<string, CategoryCreep>();
  for (const v of vendors) {
    const label = resolveLabel(v.categoryKey, v.category);
    const color = resolveColor(v.categoryKey);
    const estimated = v.budgetItems.reduce((s, b) => s + b.estimatedValue, 0);
    const actual = v.budgetItems.reduce(
      (s, b) => s + (b.actualValue ?? b.estimatedValue),
      0,
    );
    const current = map.get(label) ?? { category: label, color, estimated: 0, actual: 0, delta: 0, pct: 0 };
    current.estimated += estimated;
    current.actual += actual;
    map.set(label, current);
  }
  return Array.from(map.values())
    .map((c) => ({
      ...c,
      delta: c.actual - c.estimated,
      pct: c.estimated > 0 ? (c.actual - c.estimated) / c.estimated : 0,
    }))
    .sort((a, b) => b.delta - a.delta);
}

export type PaymentHeatCell = {
  date: string;
  amount: number;
  count: number;
};

export function buildPaymentHeatmap(
  payments: Array<{ amount: number; dueDate: Date }>,
  from: Date,
  to: Date,
): PaymentHeatCell[] {
  const cells = new Map<string, PaymentHeatCell>();
  for (const p of payments) {
    if (p.dueDate < from || p.dueDate > to) continue;
    const key = p.dueDate.toISOString().slice(0, 10);
    const c = cells.get(key) ?? { date: key, amount: 0, count: 0 };
    c.amount += p.amount;
    c.count += 1;
    cells.set(key, c);
  }
  return Array.from(cells.values()).sort((a, b) => (a.date > b.date ? 1 : -1));
}

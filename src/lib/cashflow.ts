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

/** Recomendação acionável: chave i18n (relativa a `dashboard.insights`) + params. */
export type HealthRecommendation = {
  key: string;
  params?: Record<string, string | number>;
};

export type HealthScoreResult = {
  score: number;
  breakdown: HealthScoreBreakdown[];
  alerts: string[];
  recommendations: HealthRecommendation[];
};

/** % de contratação esperada para a distância do evento (puro, reutilizável). */
export function getExpectedContractedPct(daysToEvent: number): number {
  if (daysToEvent > 365) return 0.3;
  if (daysToEvent > 180) return 0.6;
  if (daysToEvent > 90) return 0.85;
  if (daysToEvent > 30) return 0.95;
  return 1;
}

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

  const expectedContractedPct = getExpectedContractedPct(input.daysToEvent);
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

  // Recomendações acionáveis (i18n via chaves relativas a `dashboard.insights`).
  const recommendations: HealthRecommendation[] = [];
  if (contractedPct < expectedContractedPct - 0.15) {
    recommendations.push({
      key: "recommendations.lowContracted",
      params: {
        pct: Math.round(contractedPct * 100),
        expectedPct: Math.round(expectedContractedPct * 100),
      },
    });
  }
  if (cashCoverage < 0.3 && budget - input.totalPaid > 0) {
    recommendations.push({
      key: "recommendations.lowCashCoverage",
      params: { coverage: Math.round(cashCoverage * 100) },
    });
  }
  if (overdueRatio > 0.1) {
    recommendations.push({
      key: "recommendations.overdueTasksHigh",
      params: { count: input.tasksOverdue, total: input.totalTasks },
    });
  }
  if (liquidity === 0) {
    recommendations.push({ key: "recommendations.negativeMonthProjected" });
  }
  if (paidPct < 0.2 && input.daysToEvent > 90) {
    recommendations.push({
      key: "recommendations.lowPaymentProgress",
      params: { pct: Math.round(paidPct * 100), days: input.daysToEvent },
    });
  }

  return { score, breakdown, alerts, recommendations };
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

export type WaterfallBar = {
  name: string;
  delta: number;
  running: number;
  positive: boolean;
};

export function buildCategoryWaterfall(creeps: CategoryCreep[]): WaterfallBar[] {
  const sorted = [...creeps].sort((a, b) => b.delta - a.delta);
  const bars: WaterfallBar[] = [];
  let running = 0;
  for (const c of sorted) {
    if (c.delta === 0) continue;
    running += c.delta;
    bars.push({ name: c.category, delta: c.delta, running, positive: c.delta >= 0 });
  }
  const total = sorted.reduce((s, c) => s + c.delta, 0);
  bars.push({ name: "Total", delta: total, running: total, positive: total >= 0 });
  return bars;
}

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

// ---------------------------------------------------------------------------
// Helpers de projeção (funções puras, em centavos) — reutilizados por Insights,
// Metas e Caixa. Sem I/O: o caller agrega os dados do Prisma e passa números.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;
const AVG_DAYS_PER_MONTH = 30.44; // média gregoriana

type RegressionPoint = { x: number; y: number };

/** Inclinação (y por unidade de x) por mínimos quadrados; null se não há variação em x. */
function linearSlope(points: RegressionPoint[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: meanY - slope * meanX };
}

/**
 * Sobra projetada de caixa até o evento, em centavos. Negativo indica déficit.
 * Inputs assumidos não-negativos (responsabilidade do caller).
 */
export function projectLeftoverUntilEvent(input: {
  totalAssets: number;
  remainingBudget: number;
  contingencyAmount: number;
}): number {
  return Math.round(input.totalAssets - input.remainingBudget - input.contingencyAmount);
}

/**
 * Quanto poupar por mês (centavos) para atingir a meta até `targetDate`.
 * `null` quando: sem data, data no passado/hoje. `0` quando a meta já foi atingida.
 */
export function savingsPace(input: {
  currentAmount: number;
  goalAmount: number;
  targetDate: Date | null;
  today?: Date;
}): number | null {
  if (!input.targetDate) return null;
  const today = input.today ?? new Date();
  const daysRemaining = (input.targetDate.getTime() - today.getTime()) / MS_PER_DAY;
  if (daysRemaining <= 0) return null;
  const remaining = input.goalAmount - input.currentAmount;
  if (remaining <= 0) return 0;
  const monthsRemaining = Math.max(1, daysRemaining / AVG_DAYS_PER_MONTH);
  return Math.round(remaining / monthsRemaining);
}

/**
 * Data projetada para atingir a meta, via regressão linear do histórico de aportes
 * (Asset.amount acumulado ao longo do tempo). `null` se: menos de 2 pontos finitos,
 * tendência plana/decrescente (slope ≤ 0), ou projeção não-finita.
 */
export function projectGoalCompletion(input: {
  goalAmount: number;
  history: Array<{ date: Date; amount: number }>;
  today?: Date;
}): Date | null {
  const today = input.today ?? new Date();
  const points = input.history
    .filter((h) => Number.isFinite(h.amount))
    .map((h) => ({ x: (h.date.getTime() - today.getTime()) / MS_PER_DAY, y: h.amount }))
    .sort((a, b) => a.x - b.x);
  const reg = linearSlope(points);
  if (!reg || reg.slope <= 0) return null;
  const daysToGoal = (input.goalAmount - reg.intercept) / reg.slope;
  if (!Number.isFinite(daysToGoal)) return null;
  const ms = today.getTime() + Math.max(0, daysToGoal) * MS_PER_DAY;
  const date = new Date(ms);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Previsão de estouro de uma categoria a partir do histórico (estimado vs real).
 * Projeta o desvio (real − estimado) `horizonDays` à frente. `null` se < 2 pontos finitos.
 * `overrunProbability` ∈ [0,1] (proporção do estouro projetado sobre o estimado recente).
 */
export function forecastCategoryOverrun(input: {
  history: Array<{ date: Date; actual: number; estimated: number }>;
  today?: Date;
  horizonDays?: number;
}): { overrunProbability: number; projectedAmount: number } | null {
  const today = input.today ?? new Date();
  const horizon = input.horizonDays ?? 30;
  const points = input.history
    .filter((h) => Number.isFinite(h.actual) && Number.isFinite(h.estimated))
    .map((h) => ({
      x: (h.date.getTime() - today.getTime()) / MS_PER_DAY,
      y: h.actual - h.estimated,
      estimated: h.estimated,
    }))
    .sort((a, b) => a.x - b.x);
  if (points.length < 2) return null;
  const reg = linearSlope(points);
  const slope = reg ? reg.slope : 0;
  const last = points[points.length - 1];
  const estimatedRecent = last.estimated || 1;
  const projectedDelta = last.y + slope * horizon;
  const projectedAmount = Math.round(estimatedRecent + projectedDelta);
  const overrunProbability = Math.min(Math.max(projectedDelta / Math.abs(estimatedRecent), 0), 1);
  return { overrunProbability, projectedAmount };
}

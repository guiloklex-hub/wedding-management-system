import { describe, it, expect } from "vitest";
import {
  buildMonthlyCashflow,
  buildPaymentHeatmap,
  computeCategoryCreep,
  computeHealthScore,
  getExpectedContractedPct,
  projectLeftoverUntilEvent,
  savingsPace,
  projectGoalCompletion,
  forecastCategoryOverrun,
} from "./cashflow";

const DAY = 86_400_000;

describe("buildMonthlyCashflow", () => {
  const eventDate = new Date(Date.UTC(2026, 5, 1));
  const today = new Date(Date.UTC(2026, 2, 15));

  it("retorna um ponto por mês entre hoje e o evento (inclusive)", () => {
    const out = buildMonthlyCashflow({
      startingCash: 0,
      eventDate,
      today,
      incomes: [],
      payments: [],
    });
    expect(out.map((p) => p.month)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
  });

  it("propaga saldo inicial pelo running balance quando não há movimentação", () => {
    const out = buildMonthlyCashflow({
      startingCash: 1000,
      eventDate,
      today,
      incomes: [],
      payments: [],
    });
    expect(out[0].starting).toBe(1000);
    expect(out[0].ending).toBe(1000);
    expect(out.at(-1)?.ending).toBe(1000);
  });

  it("ignora rendas CANCELLED", () => {
    const out = buildMonthlyCashflow({
      startingCash: 0,
      eventDate,
      today,
      incomes: [
        {
          amount: 500,
          expectedDate: new Date(Date.UTC(2026, 2, 10)),
          receivedAt: null,
          status: "CANCELLED",
          frequency: "ONE_TIME",
        },
      ],
      payments: [],
    });
    expect(out[0].income).toBe(0);
  });

  it("aplica renda MONTHLY recorrente em todos os meses", () => {
    const out = buildMonthlyCashflow({
      startingCash: 0,
      eventDate,
      today,
      incomes: [
        {
          amount: 200,
          expectedDate: null,
          receivedAt: null,
          status: "EXPECTED",
          frequency: "MONTHLY",
        },
      ],
      payments: [],
    });
    expect(out.every((p) => p.income === 200)).toBe(true);
  });

  it("flagga isNegative quando saldo final fica abaixo de zero", () => {
    const out = buildMonthlyCashflow({
      startingCash: 100,
      eventDate,
      today,
      incomes: [],
      payments: [{ amount: 500, dueDate: today, status: "PENDING" }],
    });
    expect(out[0].isNegative).toBe(true);
    expect(out[0].ending).toBe(-400);
  });

  it("agrega múltiplos pagamentos no mesmo mês", () => {
    const out = buildMonthlyCashflow({
      startingCash: 0,
      eventDate,
      today,
      incomes: [],
      payments: [
        { amount: 100, dueDate: new Date(Date.UTC(2026, 3, 5)), status: "PENDING" },
        { amount: 250, dueDate: new Date(Date.UTC(2026, 3, 20)), status: "PENDING" },
      ],
    });
    const april = out.find((p) => p.month === "2026-04");
    expect(april?.outflow).toBe(350);
  });
});

describe("computeHealthScore", () => {
  it("score 0 quando tudo está zero (sem orçamento) mas penaliza overdue", () => {
    const r = computeHealthScore({
      totalBudget: 0,
      totalContracted: 0,
      totalPaid: 0,
      totalCash: 0,
      daysToEvent: 60,
      totalTasks: 0,
      tasksDone: 0,
      tasksOverdue: 0,
      worstMonthlyBalance: 0,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("alerta quando saldo negativo aparece na projeção", () => {
    const r = computeHealthScore({
      totalBudget: 10_000,
      totalContracted: 8_000,
      totalPaid: 5_000,
      totalCash: 4_000,
      daysToEvent: 90,
      totalTasks: 10,
      tasksDone: 5,
      tasksOverdue: 0,
      worstMonthlyBalance: -1_000,
    });
    expect(r.alerts.some((a) => a.toLowerCase().includes("negativo"))).toBe(true);
  });

  it("alerta quando >10% das tarefas estão atrasadas", () => {
    const r = computeHealthScore({
      totalBudget: 10_000,
      totalContracted: 8_000,
      totalPaid: 5_000,
      totalCash: 5_000,
      daysToEvent: 90,
      totalTasks: 10,
      tasksDone: 5,
      tasksOverdue: 3,
      worstMonthlyBalance: 1_000,
    });
    expect(r.alerts.some((a) => a.includes("atrasadas"))).toBe(true);
  });

  it("score perfeito (próximo de 100) quando tudo está em dia", () => {
    const r = computeHealthScore({
      totalBudget: 10_000,
      totalContracted: 10_000,
      totalPaid: 10_000,
      totalCash: 10_000,
      daysToEvent: 30,
      totalTasks: 10,
      tasksDone: 10,
      tasksOverdue: 0,
      worstMonthlyBalance: 5_000,
    });
    expect(r.score).toBeGreaterThanOrEqual(95);
  });
});

describe("computeCategoryCreep", () => {
  const resolveColor = () => "#fff";
  const resolveLabel = (_k: string | null, fb: string) => fb;

  it("retorna delta = actual - estimated por categoria, ordenado desc", () => {
    const out = computeCategoryCreep(
      [
        {
          category: "Buffet",
          categoryKey: "BUFFET",
          budgetItems: [{ estimatedValue: 1_000, actualValue: 1_500 }],
        },
        {
          category: "Decor",
          categoryKey: "DECOR",
          budgetItems: [{ estimatedValue: 500, actualValue: 600 }],
        },
      ],
      resolveColor,
      resolveLabel,
    );
    expect(out[0].category).toBe("Buffet");
    expect(out[0].delta).toBe(500);
    expect(out[0].pct).toBe(0.5);
    expect(out[1].delta).toBe(100);
  });

  it("usa estimatedValue quando actualValue é null", () => {
    const out = computeCategoryCreep(
      [
        {
          category: "X",
          categoryKey: "OTHER",
          budgetItems: [{ estimatedValue: 200, actualValue: null }],
        },
      ],
      resolveColor,
      resolveLabel,
    );
    expect(out[0].actual).toBe(200);
    expect(out[0].delta).toBe(0);
  });
});

describe("buildPaymentHeatmap", () => {
  it("agrupa pagamentos por dia e ignora os fora do range", () => {
    const out = buildPaymentHeatmap(
      [
        { amount: 100, dueDate: new Date("2026-01-01") },
        { amount: 200, dueDate: new Date("2026-01-01") },
        { amount: 300, dueDate: new Date("2026-01-02") },
        { amount: 999, dueDate: new Date("2025-12-31") },
      ],
      new Date("2026-01-01"),
      new Date("2026-01-31"),
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ date: "2026-01-01", amount: 300, count: 2 });
    expect(out[1]).toEqual({ date: "2026-01-02", amount: 300, count: 1 });
  });
});

describe("projectLeftoverUntilEvent", () => {
  it("retorna superávit (assets − orçamento restante − contingência)", () => {
    expect(
      projectLeftoverUntilEvent({ totalAssets: 100000, remainingBudget: 50000, contingencyAmount: 5000 }),
    ).toBe(45000);
  });

  it("retorna negativo quando há déficit", () => {
    expect(
      projectLeftoverUntilEvent({ totalAssets: 40000, remainingBudget: 50000, contingencyAmount: 5000 }),
    ).toBe(-15000);
  });
});

describe("savingsPace", () => {
  const today = new Date(Date.UTC(2026, 0, 1));

  it("retorna null sem data alvo", () => {
    expect(savingsPace({ currentAmount: 0, goalAmount: 100000, targetDate: null, today })).toBeNull();
  });

  it("retorna null se a data alvo já passou ou é hoje", () => {
    expect(
      savingsPace({ currentAmount: 0, goalAmount: 100000, targetDate: new Date(today.getTime() - DAY), today }),
    ).toBeNull();
    expect(
      savingsPace({ currentAmount: 0, goalAmount: 100000, targetDate: today, today }),
    ).toBeNull();
  });

  it("retorna 0 quando a meta já foi atingida", () => {
    expect(
      savingsPace({ currentAmount: 100000, goalAmount: 100000, targetDate: new Date(today.getTime() + 180 * DAY), today }),
    ).toBe(0);
  });

  it("calcula o ritmo mensal restante", () => {
    const pace = savingsPace({
      currentAmount: 50000,
      goalAmount: 200000,
      targetDate: new Date(today.getTime() + 180 * DAY),
      today,
    });
    // 150000 restante / ~5.91 meses ≈ 25360
    expect(pace).toBeGreaterThan(24000);
    expect(pace).toBeLessThan(27000);
  });
});

describe("projectGoalCompletion", () => {
  const today = new Date(Date.UTC(2026, 0, 1));

  it("retorna null com menos de 2 pontos", () => {
    expect(
      projectGoalCompletion({ goalAmount: 100000, history: [{ date: today, amount: 1000 }], today }),
    ).toBeNull();
  });

  it("retorna null quando a tendência é plana ou decrescente", () => {
    expect(
      projectGoalCompletion({
        goalAmount: 100000,
        history: [
          { date: new Date(today.getTime() - 60 * DAY), amount: 50000 },
          { date: new Date(today.getTime() - 30 * DAY), amount: 40000 },
        ],
        today,
      }),
    ).toBeNull();
  });

  it("ignora valores não-finitos no histórico", () => {
    const out = projectGoalCompletion({
      goalAmount: 100000,
      history: [
        { date: new Date(today.getTime() - 60 * DAY), amount: Number.NaN },
        { date: new Date(today.getTime() - 30 * DAY), amount: 30000 },
        { date: today, amount: 60000 },
      ],
      today,
    });
    expect(out).toBeInstanceOf(Date);
  });

  it("projeta data futura para tendência crescente (~30k/mês até 100k)", () => {
    const out = projectGoalCompletion({
      goalAmount: 100000,
      history: [
        { date: new Date(today.getTime() - 60 * DAY), amount: 40000 },
        { date: new Date(today.getTime() - 30 * DAY), amount: 70000 },
        { date: today, amount: 100000 },
      ],
      today,
    });
    // já em 100k hoje → projeção em torno de hoje
    expect(out).toBeInstanceOf(Date);
    expect(out!.getTime()).toBeGreaterThanOrEqual(today.getTime());
  });
});

describe("forecastCategoryOverrun", () => {
  const today = new Date(Date.UTC(2026, 0, 1));

  it("retorna null com menos de 2 pontos", () => {
    expect(
      forecastCategoryOverrun({ history: [{ date: today, actual: 1000, estimated: 900 }], today }),
    ).toBeNull();
  });

  it("indica estouro provável quando o real cresce acima do estimado", () => {
    const out = forecastCategoryOverrun({
      history: [
        { date: new Date(today.getTime() - 60 * DAY), actual: 11000, estimated: 10000 },
        { date: new Date(today.getTime() - 30 * DAY), actual: 13000, estimated: 10000 },
        { date: today, actual: 16000, estimated: 10000 },
      ],
      today,
    });
    expect(out).not.toBeNull();
    expect(out!.overrunProbability).toBeGreaterThan(0.5);
    expect(out!.projectedAmount).toBeGreaterThan(10000);
  });

  it("probabilidade ≈ 0 quando o real fica abaixo do estimado", () => {
    const out = forecastCategoryOverrun({
      history: [
        { date: new Date(today.getTime() - 60 * DAY), actual: 8000, estimated: 10000 },
        { date: new Date(today.getTime() - 30 * DAY), actual: 8500, estimated: 10000 },
        { date: today, actual: 9000, estimated: 10000 },
      ],
      today,
    });
    expect(out).not.toBeNull();
    expect(out!.overrunProbability).toBe(0);
  });
});

describe("getExpectedContractedPct", () => {
  it("escalona conforme a distância do evento", () => {
    expect(getExpectedContractedPct(400)).toBe(0.3);
    expect(getExpectedContractedPct(200)).toBe(0.6);
    expect(getExpectedContractedPct(100)).toBe(0.85);
    expect(getExpectedContractedPct(45)).toBe(0.95);
    expect(getExpectedContractedPct(10)).toBe(1);
  });
});

describe("computeHealthScore recommendations", () => {
  const base = {
    totalBudget: 10_000,
    totalContracted: 10_000,
    totalPaid: 10_000,
    totalCash: 10_000,
    daysToEvent: 30,
    totalTasks: 10,
    tasksDone: 10,
    tasksOverdue: 0,
    worstMonthlyBalance: 5_000,
  };

  it("não gera recomendações quando tudo está em dia", () => {
    expect(computeHealthScore(base).recommendations).toHaveLength(0);
  });

  it("recomenda fechar fornecedores quando a contratação está atrasada", () => {
    const r = computeHealthScore({ ...base, totalContracted: 1_000, daysToEvent: 60 });
    const rec = r.recommendations.find((x) => x.key === "recommendations.lowContracted");
    expect(rec).toBeTruthy();
    expect(rec!.params).toMatchObject({ pct: 10, expectedPct: 95 });
  });

  it("recomenda reforçar caixa quando a cobertura é baixa", () => {
    const r = computeHealthScore({ ...base, totalCash: 100, totalPaid: 0 });
    expect(r.recommendations.some((x) => x.key === "recommendations.lowCashCoverage")).toBe(true);
  });

  it("recomenda destravar tarefas atrasadas e mês negativo", () => {
    const r = computeHealthScore({ ...base, tasksOverdue: 3, worstMonthlyBalance: -500 });
    const keys = r.recommendations.map((x) => x.key);
    expect(keys).toContain("recommendations.overdueTasksHigh");
    expect(keys).toContain("recommendations.negativeMonthProjected");
  });

  it("recomenda antecipar pagamentos quando pouco foi pago e o evento está longe", () => {
    const r = computeHealthScore({ ...base, totalPaid: 0, daysToEvent: 200, totalContracted: 6_000 });
    expect(r.recommendations.some((x) => x.key === "recommendations.lowPaymentProgress")).toBe(true);
  });
});

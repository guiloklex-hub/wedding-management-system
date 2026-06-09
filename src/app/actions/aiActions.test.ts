import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@/test-utils/prisma";

const aiFeatureEnabledMock = vi.fn();
const generateTextMock = vi.fn();
const loadSnapshotMock = vi.fn();
const recordAiGenerationMock = vi.fn();

vi.mock("@/lib/ai/aiAccess", () => ({ aiFeatureEnabled: () => aiFeatureEnabledMock() }));
vi.mock("@/lib/ai/generate", () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));
vi.mock("@/lib/reports/insights-snapshot", () => ({
  loadInsightsSnapshot: () => loadSnapshotMock(),
}));
vi.mock("@/lib/ai/log", () => ({
  recordAiGeneration: (...args: unknown[]) => recordAiGenerationMock(...args),
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1" } })) }));

import { generateInsightsNarrative } from "./aiActions";

const SNAP = {
  eventDate: new Date("2026-11-15T00:00:00Z"),
  contingencyPercent: 10,
  currency: "BRL",
  coupleNames: "Ana & Beto",
  totals: { budget: 100, contracted: 70, paid: 40, cash: 35 },
  daysToEvent: 120,
  leftover: 5,
  cashflow: [],
  worstMonthlyBalance: -2,
  health: {
    score: 72,
    breakdown: [{ label: "Cobertura", weight: 0.25, rawValue: 0.7, normalized: 0.7 }],
    alerts: [],
    recommendations: [],
  },
  creep: [],
  heatmap: [],
  sCurve: [],
  burndown: [],
  waterfall: [],
};

beforeEach(() => {
  aiFeatureEnabledMock.mockReset();
  generateTextMock.mockReset();
  loadSnapshotMock.mockReset();
  recordAiGenerationMock.mockReset();
  recordAiGenerationMock.mockResolvedValue(undefined);
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

describe("generateInsightsNarrative", () => {
  it("recusa quando a IA está desabilitada (gate)", async () => {
    aiFeatureEnabledMock.mockResolvedValue(false);
    const r = await generateInsightsNarrative();
    expect(r.success).toBe(false);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("erro quando o evento não tem data", async () => {
    aiFeatureEnabledMock.mockResolvedValue(true);
    loadSnapshotMock.mockResolvedValue(null);
    const r = await generateInsightsNarrative();
    expect(r.success).toBe(false);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("retorna a narrativa no sucesso e registra status OK", async () => {
    aiFeatureEnabledMock.mockResolvedValue(true);
    loadSnapshotMock.mockResolvedValue(SNAP);
    generateTextMock.mockResolvedValue({
      ok: true,
      data: "Vocês estão no caminho certo.",
      usage: { inputTokens: 1, outputTokens: 2 },
    });
    const r = await generateInsightsNarrative();
    expect(r).toEqual({ success: true, data: "Vocês estão no caminho certo." });
    expect(recordAiGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "OK", resource: "insights.narrative" }),
    );
  });

  it("mapeia código de erro e registra o status correspondente", async () => {
    aiFeatureEnabledMock.mockResolvedValue(true);
    loadSnapshotMock.mockResolvedValue(SNAP);
    generateTextMock.mockResolvedValue({ ok: false, code: "TIMEOUT" });
    const r = await generateInsightsNarrative();
    expect(r.success).toBe(false);
    expect(recordAiGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "TIMEOUT" }),
    );
  });
});

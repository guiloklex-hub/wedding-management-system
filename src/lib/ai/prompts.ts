// Construtores de prompt — funções PURAS (testáveis, sem I/O, sem server-only).
// Dados do usuário entram como bloco DELIMITADO (nunca como instrução) para
// reduzir prompt-injection. Valores monetários chegam já formatados pelo caller
// (formatCurrency), evitando que o modelo precise interpretar centavos/moeda.

const LANGUAGE_NAME: Record<string, string> = {
  "pt-BR": "português do Brasil",
  en: "English",
  es: "español",
};

function languageName(locale: string): string {
  return LANGUAGE_NAME[locale] ?? LANGUAGE_NAME["pt-BR"];
}

export type InsightsNarrativeInput = {
  locale: string;
  coupleNames: string | null;
  daysToEvent: number;
  healthScore: number;
  money: {
    budget: string;
    contracted: string;
    paid: string;
    cash: string;
    leftover: string;
    worstMonthlyBalance: string;
  };
  breakdown: { label: string; pct: number }[];
  alerts: string[];
  topCreep: { category: string; deltaLabel: string; pct: number }[];
};

export function buildInsightsNarrativePrompt(input: InsightsNarrativeInput): {
  system: string;
  user: string;
} {
  const lang = languageName(input.locale);
  const system = [
    `Você é um assistente financeiro de casamento. Escreva SEMPRE em ${lang}.`,
    "Produza um resumo curto (2 a 4 parágrafos OU até 6 marcadores) explicando a saúde financeira do casamento de forma acolhedora, porém honesta.",
    "Baseie-se EXCLUSIVAMENTE nos dados do bloco DADOS. Nunca invente números, datas ou fornecedores.",
    "Não apenas repita os números: interprete o que vai bem, o que é risco e sugira de 1 a 3 ações práticas.",
    "Sem saudações ('Olá'), sem assinatura, sem tabelas. Apenas texto corrido ou marcadores.",
  ].join(" ");

  const data = {
    casal: input.coupleNames,
    diasParaOEvento: input.daysToEvent,
    scoreSaude: input.healthScore,
    orcamentoTotal: input.money.budget,
    contratado: input.money.contracted,
    pago: input.money.paid,
    caixaAtual: input.money.cash,
    sobraProjetada: input.money.leftover,
    piorSaldoMensalProjetado: input.money.worstMonthlyBalance,
    componentesDoScore: input.breakdown.map((b) => ({
      nome: b.label,
      percentual: Math.round(b.pct * 100),
    })),
    alertas: input.alerts,
    categoriasComMaiorDesvio: input.topCreep.map((c) => ({
      categoria: c.category,
      desvio: c.deltaLabel,
      percentual: Math.round(c.pct * 100),
    })),
  };

  const user = [
    "DADOS (use para escrever o resumo; não exiba como JSON):",
    "<dados>",
    JSON.stringify(data, null, 2),
    "</dados>",
    "",
    "Escreva o resumo agora.",
  ].join("\n");

  return { system, user };
}

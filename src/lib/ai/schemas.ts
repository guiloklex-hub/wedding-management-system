import { z } from "zod";

// Schemas Zod de SAÍDA das gerações estruturadas (texto→JSON). A validação no
// servidor é a fonte da verdade — o responseSchema do Gemini é apenas um hint.
// Limites explícitos (AGENTS.md §5.10). Novos schemas entram nas ondas seguintes
// (itinerário de lua de mel, enxoval, timeline do dia, extração de contrato).

export const BudgetBreakdownSchema = z.object({
  items: z
    .array(
      z.object({
        categoryKey: z.string().max(64),
        label: z.string().max(120),
        estimatedPercent: z.number().min(0).max(100),
        rationale: z.string().max(500),
      }),
    )
    .max(25),
});
export type BudgetBreakdown = z.infer<typeof BudgetBreakdownSchema>;

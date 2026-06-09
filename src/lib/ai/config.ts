import "server-only";

// Master switch da IA: o recurso só existe quando há GEMINI_API_KEY no ambiente.
// Sem chave, `isAiEnabled()` é false, a camada recusa e a UI não renderiza botões.

export type AiConfig = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 2048;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function isAiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getAiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** Configuração resolvida do provedor, ou `null` quando a IA está desligada. Nunca lança. */
export function getAiConfig(): AiConfig | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: getAiModel(),
    timeoutMs: parsePositiveInt(process.env.GEMINI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxOutputTokens: parsePositiveInt(
      process.env.GEMINI_MAX_OUTPUT_TOKENS,
      DEFAULT_MAX_OUTPUT_TOKENS,
    ),
  };
}

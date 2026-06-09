// Tipos puros do resultado de uma chamada de IA. A camada `ai/` NUNCA lança —
// sempre devolve um `AiResult` discriminado para o caller decidir a UX.
// Sem `server-only`: tipos podem ser importados por testes e tipos compartilhados.

export type AiErrorCode =
  | "DISABLED" // sem GEMINI_API_KEY (master switch desligado)
  | "RATE_LIMITED" // estourou o bucket por usuário+recurso
  | "TIMEOUT" // abortado por AbortSignal (timeout interno ou externo)
  | "INVALID_OUTPUT" // saída estruturada não passou no Zod / JSON inválido
  | "BLOCKED" // bloqueado por safety/recitation (finishReason)
  | "PROVIDER_ERROR"; // erro de rede/API ou resposta vazia

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type AiResult<T> =
  | { ok: true; data: T; usage?: AiUsage }
  | { ok: false; code: AiErrorCode };

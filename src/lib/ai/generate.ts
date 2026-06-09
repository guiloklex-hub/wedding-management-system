import "server-only";
import {
  FinishReason,
  type GenerateContentResponse,
  type Schema,
} from "@google/genai";
import type { z } from "zod";
import { getAiClient } from "./client";
import { getAiConfig, isAiEnabled } from "./config";
import { checkAiRateLimit } from "./rate-limit";
import type { AiResult, AiUsage } from "./errors";

export type GenerateOpts = {
  userId: string;
  /** Identificador estável do caso de uso (rate-limit + auditoria). Ex.: "insights.narrative". */
  resource: string;
  locale?: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** AbortSignal externo, combinado com o timeout interno. */
  signal?: AbortSignal;
  /** Schema nativo do Gemini para geração estruturada (opcional; a validação final é sempre Zod). */
  responseSchema?: Schema;
};

// finishReasons que indicam bloqueio por política — viram AiErrorCode "BLOCKED".
const BLOCKED_REASONS = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
  FinishReason.IMAGE_SAFETY,
]);

function extractUsage(res: GenerateContentResponse): AiUsage | undefined {
  const u = res.usageMetadata;
  if (!u) return undefined;
  return { inputTokens: u.promptTokenCount, outputTokens: u.candidatesTokenCount };
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")
  );
}

async function callGemini(
  prompt: string,
  opts: GenerateOpts,
  json: boolean,
): Promise<AiResult<{ text: string; usage?: AiUsage }>> {
  if (!isAiEnabled()) return { ok: false, code: "DISABLED" };

  const rl = checkAiRateLimit(opts.userId, opts.resource);
  if (!rl.ok) return { ok: false, code: "RATE_LIMITED" };

  const client = getAiClient();
  const cfg = getAiConfig();
  if (!client || !cfg) return { ok: false, code: "DISABLED" };

  const timeout = AbortSignal.timeout(cfg.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  try {
    const res = await client.models.generateContent({
      model: cfg.model,
      contents: prompt,
      config: {
        abortSignal: signal,
        systemInstruction: opts.system,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens ?? cfg.maxOutputTokens,
        ...(json
          ? {
              responseMimeType: "application/json",
              ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
            }
          : {}),
      },
    });

    const finishReason = res.candidates?.[0]?.finishReason;
    if (finishReason && BLOCKED_REASONS.has(finishReason)) {
      return { ok: false, code: "BLOCKED" };
    }

    const text = res.text;
    if (!text || text.trim().length === 0) {
      return { ok: false, code: "PROVIDER_ERROR" };
    }

    return { ok: true, data: { text, usage: extractUsage(res) } };
  } catch (err) {
    if (isAbortError(err)) return { ok: false, code: "TIMEOUT" };
    // Não logar prompt/saída (podem conter PII). Apenas o recurso.
    console.error("[ai] generateContent failed", { resource: opts.resource });
    return { ok: false, code: "PROVIDER_ERROR" };
  }
}

/** Geração de texto livre. Nunca lança. */
export async function generateText(
  prompt: string,
  opts: GenerateOpts,
): Promise<AiResult<string>> {
  const res = await callGemini(prompt, opts, false);
  if (!res.ok) return res;
  return { ok: true, data: res.data.text, usage: res.data.usage };
}

/**
 * Geração estruturada: pede JSON ao modelo e valida com Zod no servidor.
 * `responseSchema` (opcional) é só um hint para o Gemini — a fonte da verdade é o Zod.
 * JSON inválido ou que não passe no schema vira `INVALID_OUTPUT`. Nunca lança.
 */
export async function generateStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  opts: GenerateOpts,
): Promise<AiResult<T>> {
  const res = await callGemini(prompt, opts, true);
  if (!res.ok) return res;

  let parsed: unknown;
  try {
    parsed = JSON.parse(res.data.text);
  } catch {
    return { ok: false, code: "INVALID_OUTPUT" };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) return { ok: false, code: "INVALID_OUTPUT" };

  return { ok: true, data: result.data, usage: res.data.usage };
}

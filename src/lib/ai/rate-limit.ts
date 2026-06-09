import "server-only";
import { rateLimit } from "@/lib/rate-limit";

// Limita chamadas de IA por usuário + recurso (autenticado, então a chave usa
// userId em vez de IP). Reaproveita o bucket in-memory de src/lib/rate-limit.ts.

const DEFAULT_MAX = 20;
const DEFAULT_WINDOW_MS = 5 * 60_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function checkAiRateLimit(
  userId: string,
  resource: string,
): { ok: boolean; resetAt: number } {
  const max = parsePositiveInt(process.env.AI_RATE_MAX, DEFAULT_MAX);
  const windowMs = parsePositiveInt(process.env.AI_RATE_WINDOW_MS, DEFAULT_WINDOW_MS);
  const r = rateLimit(`ai:${resource}:${userId}`, max, windowMs);
  return { ok: r.ok, resetAt: r.resetAt };
}

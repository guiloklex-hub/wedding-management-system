import "server-only";
import { prisma } from "@/lib/prisma";
import type { AiUsage } from "./errors";

// Persiste metadados de cada geração de IA (sem PII bruta). `outputPreview` é
// truncado; para features que lidam com PII (ex.: dados de convidados), passe null.
// Best-effort: nunca lança.

const PREVIEW_MAX = 280;

export async function recordAiGeneration(entry: {
  userId?: string | null;
  resource: string;
  model: string;
  status: string;
  usage?: AiUsage;
  outputPreview?: string | null;
}): Promise<void> {
  try {
    await prisma.aiGeneration.create({
      data: {
        userId: entry.userId ?? null,
        resource: entry.resource,
        model: entry.model,
        status: entry.status,
        inputTokens: entry.usage?.inputTokens ?? null,
        outputTokens: entry.usage?.outputTokens ?? null,
        outputPreview: entry.outputPreview
          ? entry.outputPreview.slice(0, PREVIEW_MAX)
          : null,
      },
    });
  } catch {
    console.error("[ai] failed to record generation", { resource: entry.resource });
  }
}

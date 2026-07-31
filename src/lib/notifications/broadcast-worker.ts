import { prisma } from "@/lib/prisma";
import {
  loadSaveTheDateContext,
  resolveTargetLocale,
  sendSaveTheDate,
  type SaveTheDateContext,
} from "./save-the-date";
import {
  loadInvitationContextFromPayload,
  sendInvitation,
  RecipientPayloadSchema,
  type InvitationContext,
} from "./official-invitation";

const INTERVAL_MS = Math.max(1000, Number(process.env.BROADCAST_INTERVAL_MS ?? 4000));
const STALE_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

type WorkerGlobals = {
  _broadcastTimer?: ReturnType<typeof setInterval> | null;
  _broadcastBusy?: boolean;
};
const g = globalThis as unknown as WorkerGlobals;

export type ProcessOutcome = "SENT" | "FAILED" | "SKIPPED" | "IDLE";

const contextCache = new Map<string, { kind: string; ctx: SaveTheDateContext | InvitationContext }>();

/**
 * Worker em processo (mesmo padrão do watchdog do WhatsApp): acorda em intervalo
 * fixo, processa UM destinatário pendente por vez com throttle anti-ban. É
 * retomável — após um restart só pega os `PENDING` e recupera os `PROCESSING` antigos.
 */
export function armBroadcastWorker(): void {
  if (g._broadcastTimer) return;
  const timer = setInterval(() => {
    void tick();
  }, INTERVAL_MS);
  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as { unref: () => void }).unref();
  }
  g._broadcastTimer = timer;
}

async function tick(): Promise<void> {
  if (g._broadcastBusy) return;
  g._broadcastBusy = true;
  try {
    await recoverStaleProcessingRecipients();
    await processOne();
  } catch (err) {
    console.error("[broadcast] tick falhou", err);
  } finally {
    g._broadcastBusy = false;
  }
}

/**
 * Converte destinatários presos em `PROCESSING` há mais de 5 minutos para `FAILED`
 * com motivo `DELIVERY_STATE_UNKNOWN`, para evitar reenvio automático em estado incerto.
 */
export async function recoverStaleProcessingRecipients(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_TIMEOUT_MS);
  const result = await prisma.broadcastRecipient.updateMany({
    where: {
      status: "PROCESSING",
      processingStartedAt: { lte: cutoff },
    },
    data: {
      status: "FAILED",
      error: "DELIVERY_STATE_UNKNOWN",
      processingStartedAt: null,
    },
  });
  return result.count;
}

/**
 * Processa um único destinatário pendente do broadcast `SENDING` mais antigo.
 * Usa claim atômico (PENDING -> PROCESSING) para evitar concorrência.
 * Quando não há mais pendentes nem em processamento, marca o broadcast como `DONE`.
 */
export async function processOne(
  injectedCtx?: SaveTheDateContext,
): Promise<ProcessOutcome> {
  const broadcast = await prisma.broadcast.findFirst({
    where: { status: "SENDING" },
    orderBy: { startedAt: "asc" },
  });
  if (!broadcast) return "IDLE";

  const recipient = await prisma.broadcastRecipient.findFirst({
    where: { broadcastId: broadcast.id, status: "PENDING" },
    orderBy: { id: "asc" },
  });

  if (!recipient) {
    // Verificar se ainda existem itens em PROCESSING
    const processingCount = await prisma.broadcastRecipient.count({
      where: { broadcastId: broadcast.id, status: "PROCESSING" },
    });
    if (processingCount === 0) {
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { status: "DONE", finishedAt: new Date() },
      });
      contextCache.delete(broadcast.id);
    }
    return "IDLE";
  }

  // Claim atômico: altera PENDING -> PROCESSING
  const claimResult = await prisma.broadcastRecipient.updateMany({
    where: {
      id: recipient.id,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
      processingStartedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  if (claimResult.count === 0) {
    // Outra execução reivindicou o mesmo destinatário
    return "IDLE";
  }

  // Despacho por kind
  if (broadcast.kind === "SAVE_THE_DATE") {
    return processSaveTheDateRecipient(broadcast.id, recipient, injectedCtx);
  } else if (broadcast.kind === "OFFICIAL_INVITATION") {
    return processOfficialInvitationRecipient(broadcast.id, recipient, broadcast.payloadJson);
  } else {
    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "FAILED",
        error: "UNKNOWN_BROADCAST_KIND",
        processingStartedAt: null,
      },
    });
    return "FAILED";
  }
}

async function processSaveTheDateRecipient(
  broadcastId: string,
  recipient: {
    id: string;
    phone: string | null;
    email: string | null;
    locale: string | null;
    memberNames: string;
    refType: string;
    refId: string;
  },
  injectedCtx?: SaveTheDateContext,
): Promise<ProcessOutcome> {
  if (!recipient.phone && !recipient.email) {
    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: "SKIPPED", error: "Sem telefone e sem e-mail", processingStartedAt: null },
    });
    return "SKIPPED";
  }

  let ctx = injectedCtx;
  if (!ctx) {
    const cached = contextCache.get(broadcastId);
    if (cached && cached.kind === "SAVE_THE_DATE") {
      ctx = cached.ctx as SaveTheDateContext;
    } else {
      const loaded = await loadSaveTheDateContext();
      if (!loaded.ok) {
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: { status: "FAILED", error: loaded.error, processingStartedAt: null },
        });
        return "FAILED";
      }
      ctx = loaded.ctx;
      contextCache.set(broadcastId, { kind: "SAVE_THE_DATE", ctx });
    }
  }

  let result;
  try {
    result = await sendSaveTheDate({
      ctx,
      target: {
        email: recipient.email,
        phone: recipient.phone,
        locale: resolveTargetLocale(recipient.locale, ctx.defaultLocale),
      },
      recipientNames: recipient.memberNames,
      refType: recipient.refType,
      refId: recipient.refId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: "FAILED", error: message, processingStartedAt: null },
    });
    return "FAILED";
  }

  const ok = result.whatsapp.ok || result.email.ok;
  const channelUsed = result.whatsapp.ok ? "WHATSAPP" : result.email.ok ? "EMAIL" : null;
  const error = ok ? null : result.whatsapp.error || result.email.error || "Falha no envio";

  await prisma.broadcastRecipient.update({
    where: { id: recipient.id },
    data: {
      status: ok ? "SENT" : "FAILED",
      channelUsed,
      error,
      sentAt: ok ? new Date() : null,
      processingStartedAt: null,
    },
  });

  return ok ? "SENT" : "FAILED";
}

async function processOfficialInvitationRecipient(
  broadcastId: string,
  recipient: {
    id: string;
    phone: string | null;
    email: string | null;
    locale: string | null;
    memberNames: string;
    refType: string;
    refId: string;
    payloadJson: string | null;
  },
  broadcastPayloadJson: string | null,
): Promise<ProcessOutcome> {
  if (!broadcastPayloadJson) {
    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: "FAILED", error: "BROADCAST_PAYLOAD_MISSING", processingStartedAt: null },
    });
    return "FAILED";
  }

  let ctx: InvitationContext;
  const cached = contextCache.get(broadcastId);
  if (cached && cached.kind === "OFFICIAL_INVITATION") {
    ctx = cached.ctx as InvitationContext;
  } else {
    const loaded = await loadInvitationContextFromPayload(broadcastPayloadJson);
    if (!loaded.ok) {
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", error: loaded.error, processingStartedAt: null },
      });
      return "FAILED";
    }
    ctx = loaded.ctx;
    contextCache.set(broadcastId, { kind: "OFFICIAL_INVITATION", ctx });
  }

  // Validação do snapshot do recipient
  if (!recipient.payloadJson) {
    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: "FAILED", error: "RECIPIENT_PAYLOAD_MISSING", processingStartedAt: null },
    });
    return "FAILED";
  }

  let recipientPayload;
  try {
    const raw = JSON.parse(recipient.payloadJson);
    const parsed = RecipientPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", error: "INVALID_RECIPIENT_PAYLOAD", processingStartedAt: null },
      });
      return "FAILED";
    }
    recipientPayload = parsed.data;
  } catch {
    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: "FAILED", error: "INVALID_RECIPIENT_PAYLOAD", processingStartedAt: null },
    });
    return "FAILED";
  }

  let sendRes;
  try {
    sendRes = await sendInvitation({
      ctx,
      recipientPayload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: "FAILED", error: message, processingStartedAt: null },
    });
    return "FAILED";
  }

  await prisma.broadcastRecipient.update({
    where: { id: recipient.id },
    data: {
      status: sendRes.ok ? "SENT" : "FAILED",
      channelUsed: sendRes.channelUsed ?? null,
      error: sendRes.ok ? null : sendRes.error ?? "Falha no envio",
      sentAt: sendRes.ok ? new Date() : null,
      processingStartedAt: null,
    },
  });

  return sendRes.ok ? "SENT" : "FAILED";
}

/** Há broadcast em andamento com pendentes ou em processamento? (usado para rearmar após boot) */
export async function hasPendingBroadcast(): Promise<boolean> {
  const count = await prisma.broadcastRecipient.count({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      broadcast: { status: "SENDING" },
    },
  });
  return count > 0;
}

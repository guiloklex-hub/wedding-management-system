import { prisma } from "@/lib/prisma";
import {
  loadSaveTheDateContext,
  resolveTargetLocale,
  sendSaveTheDate,
  type SaveTheDateContext,
} from "./save-the-date";

const INTERVAL_MS = Math.max(1000, Number(process.env.BROADCAST_INTERVAL_MS ?? 4000));

type WorkerGlobals = {
  _broadcastTimer?: ReturnType<typeof setInterval> | null;
  _broadcastBusy?: boolean;
};
const g = globalThis as unknown as WorkerGlobals;

export type ProcessOutcome = "SENT" | "FAILED" | "SKIPPED" | "IDLE";

/**
 * Worker em processo (mesmo padrão do watchdog do WhatsApp): acorda em intervalo
 * fixo, processa UM destinatário pendente por vez com throttle anti-ban. É
 * retomável — após um restart só pega os `PENDING`.
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
    await processOne();
  } catch (err) {
    console.error("[broadcast] tick falhou", err);
  } finally {
    g._broadcastBusy = false;
  }
}

/**
 * Processa um único destinatário pendente do broadcast `SENDING` mais antigo.
 * Quando não há mais pendentes, fecha o broadcast (`DONE`). Pode receber um
 * contexto pré-carregado (cron) para evitar reler a arte do disco a cada item.
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
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: "DONE", finishedAt: new Date() },
    });
    return "IDLE";
  }

  if (!recipient.phone && !recipient.email) {
    await prisma.broadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: "SKIPPED", error: "Sem telefone e sem e-mail" },
    });
    return "SKIPPED";
  }

  let ctx = injectedCtx;
  if (!ctx) {
    const loaded = await loadSaveTheDateContext();
    if (!loaded.ok) {
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", error: loaded.error },
      });
      return "FAILED";
    }
    ctx = loaded.ctx;
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
      data: { status: "FAILED", error: message },
    });
    return "FAILED";
  }

  const ok = result.whatsapp.ok || result.email.ok;
  const channelUsed = result.whatsapp.ok ? "WHATSAPP" : result.email.ok ? "EMAIL" : null;
  const error = ok
    ? null
    : result.whatsapp.error || result.email.error || "Falha no envio";

  await prisma.broadcastRecipient.update({
    where: { id: recipient.id },
    data: {
      status: ok ? "SENT" : "FAILED",
      channelUsed,
      error,
      sentAt: ok ? new Date() : null,
    },
  });

  return ok ? "SENT" : "FAILED";
}

/** Há broadcast em andamento com pendentes? (usado para rearmar após boot) */
export async function hasPendingBroadcast(): Promise<boolean> {
  const pending = await prisma.broadcastRecipient.count({
    where: { status: "PENDING", broadcast: { status: "SENDING" } },
  });
  return pending > 0;
}

import { prisma } from "@/lib/prisma";
import type { NotificationKind } from "./templates";

export type LogEntry = {
  kind: NotificationKind;
  channel: "EMAIL" | "WHATSAPP";
  userId?: string | null;
  targetEmail?: string | null;
  targetPhone?: string | null;
  status: "SENT" | "FAILED";
  errorMsg?: string | null;
  refType?: string | null;
  refId?: string | null;
};

export async function logNotification(entry: LogEntry): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        kind: entry.kind,
        channel: entry.channel,
        userId: entry.userId ?? null,
        targetEmail: entry.targetEmail ?? null,
        targetPhone: entry.targetPhone ?? null,
        status: entry.status,
        errorMsg: entry.errorMsg ?? null,
        refType: entry.refType ?? null,
        refId: entry.refId ?? null,
      },
    });
  } catch (err) {
    console.error("[NotificationLog] falha ao persistir log", err);
  }
}

/**
 * Retorna o início do dia atual no fuso BRT (UTC-3) como Date UTC.
 * Mantém consistência com `todayBRT()` do cron de lembretes.
 */
export function startOfTodayBRT(): Date {
  const now = new Date();
  const brtOffsetMs = -3 * 60 * 60 * 1000;
  const brtNowMs = now.getTime() + brtOffsetMs;
  const brt = new Date(brtNowMs);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() - brtOffsetMs);
}

export async function wasNotifiedToday(
  kind: NotificationKind,
  refType: string,
  refId: string,
  startOfDay: Date = startOfTodayBRT(),
): Promise<boolean> {
  const count = await prisma.notificationLog.count({
    where: {
      kind,
      refType,
      refId,
      status: "SENT",
      createdAt: { gte: startOfDay },
    },
  });
  return count > 0;
}

export type NotifiedKey = `${NotificationKind}:${string}:${string}`;

export async function loadNotifiedTodaySet(
  kinds: NotificationKind[],
  startOfDay: Date = startOfTodayBRT(),
): Promise<Set<NotifiedKey>> {
  if (kinds.length === 0) return new Set();
  const rows = await prisma.notificationLog.findMany({
    where: {
      kind: { in: kinds },
      status: "SENT",
      createdAt: { gte: startOfDay },
    },
    select: { kind: true, refType: true, refId: true },
  });
  const set = new Set<NotifiedKey>();
  for (const r of rows) {
    if (r.refType && r.refId) {
      set.add(`${r.kind as NotificationKind}:${r.refType}:${r.refId}`);
    }
  }
  return set;
}

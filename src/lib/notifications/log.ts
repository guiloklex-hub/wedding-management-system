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

export async function wasNotifiedToday(
  kind: NotificationKind,
  refType: string,
  refId: string,
): Promise<boolean> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const count = await prisma.notificationLog.count({
    where: {
      kind,
      refType,
      refId,
      status: "SENT",
      createdAt: { gte: start },
    },
  });
  return count > 0;
}

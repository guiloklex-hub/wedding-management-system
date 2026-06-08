import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { loadNotifiedTodaySet, startOfTodayBRT, type NotifiedKey } from "@/lib/notifications/log";
import type { NotificationKind } from "@/lib/notifications/templates";
import { timingSafeEquals } from "@/lib/timing-safe";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { computeAdjustedAmount } from "@/lib/payment-adjustment";
import { coerceLocale } from "@/i18n/config";
import { getEventConfig } from "@/lib/event-config";
import { selectRsvpReminderTargets } from "@/lib/notifications/rsvp-reminder";

export const dynamic = "force-dynamic";

const NOTIFY_ROLES = ["ADMIN", "GROOM", "BRIDE", "PLANNER"];

function todayBRT(): Date {
  return startOfTodayBRT();
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function notifiedKey(kind: NotificationKind, refType: string, refId: string): NotifiedKey {
  return `${kind}:${refType}:${refId}`;
}

type Summary = {
  paymentsDue: number;
  paymentsOverdue: number;
  tasksDue: number;
  tasksOverdue: number;
  rsvpReminders: number;
  skippedAlreadyNotified: number;
};

export async function GET(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`cron-reminders:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: "CRON_SECRET não configurado" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!timingSafeEquals(auth, expected)) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const summary: Summary = {
    paymentsDue: 0,
    paymentsOverdue: 0,
    tasksDue: 0,
    tasksOverdue: 0,
    rsvpReminders: 0,
    skippedAlreadyNotified: 0,
  };

  const today = todayBRT();
  const in3Days = new Date(today.getTime() + 3 * 86_400_000);
  const in2Days = new Date(today.getTime() + 2 * 86_400_000);

  const [recipients, sentSet, upcomingPayments, overduePayments, upcomingTasks, overdueTasks] =
    await Promise.all([
      prisma.user.findMany({
        where: { isActive: true, archivedAt: null, role: { in: NOTIFY_ROLES } },
        select: { id: true, name: true, email: true, phone: true, locale: true },
      }),
      loadNotifiedTodaySet(
        ["PAYMENT_DUE", "PAYMENT_OVERDUE", "TASK_DUE", "TASK_OVERDUE", "RSVP_REMINDER", "RSVP_REMINDER_GROUP"],
        today,
      ),
      prisma.payment.findMany({
        where: {
          status: "PENDING",
          deletedAt: null,
          dueDate: { gte: today, lte: in3Days },
        },
        include: { vendor: { select: { name: true } } },
      }),
      prisma.payment.findMany({
        where: { status: "PENDING", deletedAt: null, dueDate: { lt: today } },
        include: { vendor: { select: { name: true } } },
      }),
      prisma.task.findMany({
        where: {
          status: "TODO",
          deletedAt: null,
          deadline: { gte: today, lte: in2Days },
        },
      }),
      prisma.task.findMany({
        where: { status: "TODO", deletedAt: null, deadline: { lt: today, not: null } },
      }),
    ]);

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, summary, note: "Sem destinatários" });
  }

  for (const p of upcomingPayments) {
    if (sentSet.has(notifiedKey("PAYMENT_DUE", "Payment", p.id))) {
      summary.skippedAlreadyNotified += 1;
      continue;
    }
    const daysUntilDue = Math.max(1, daysBetween(today, p.dueDate));
    await Promise.all(
      recipients.map((u) =>
        notify(
          { userId: u.id, email: u.email, phone: u.phone, locale: coerceLocale(u.locale) },
          {
            kind: "PAYMENT_DUE",
            userName: u.name ?? u.email,
            vendorName: p.vendor.name,
            amount: p.amount,
            dueDate: p.dueDate,
            daysUntilDue,
          },
          { refType: "Payment", refId: p.id },
        ),
      ),
    );
    summary.paymentsDue += 1;
  }

  for (const p of overduePayments) {
    if (sentSet.has(notifiedKey("PAYMENT_OVERDUE", "Payment", p.id))) {
      summary.skippedAlreadyNotified += 1;
      continue;
    }
    const daysOverdue = Math.max(1, daysBetween(p.dueDate, today));
    const adj = computeAdjustedAmount(p, today);
    await Promise.all(
      recipients.map((u) =>
        notify(
          { userId: u.id, email: u.email, phone: u.phone, locale: coerceLocale(u.locale) },
          {
            kind: "PAYMENT_OVERDUE",
            userName: u.name ?? u.email,
            vendorName: p.vendor.name,
            amount: adj.adjusted,
            dueDate: p.dueDate,
            daysOverdue,
          },
          { refType: "Payment", refId: p.id },
        ),
      ),
    );
    summary.paymentsOverdue += 1;
  }

  for (const t of upcomingTasks) {
    if (!t.deadline) continue;
    if (sentSet.has(notifiedKey("TASK_DUE", "Task", t.id))) {
      summary.skippedAlreadyNotified += 1;
      continue;
    }
    const daysUntilDeadline = Math.max(1, daysBetween(today, t.deadline));
    await Promise.all(
      recipients.map((u) =>
        notify(
          { userId: u.id, email: u.email, phone: u.phone, locale: coerceLocale(u.locale) },
          {
            kind: "TASK_DUE",
            userName: u.name ?? u.email,
            taskTitle: t.title,
            deadline: t.deadline!,
            daysUntilDeadline,
          },
          { refType: "Task", refId: t.id },
        ),
      ),
    );
    summary.tasksDue += 1;
  }

  for (const t of overdueTasks) {
    if (!t.deadline) continue;
    if (sentSet.has(notifiedKey("TASK_OVERDUE", "Task", t.id))) {
      summary.skippedAlreadyNotified += 1;
      continue;
    }
    const daysOverdue = Math.max(1, daysBetween(t.deadline, today));
    await Promise.all(
      recipients.map((u) =>
        notify(
          { userId: u.id, email: u.email, phone: u.phone, locale: coerceLocale(u.locale) },
          {
            kind: "TASK_OVERDUE",
            userName: u.name ?? u.email,
            taskTitle: t.title,
            deadline: t.deadline!,
            daysOverdue,
          },
          { refType: "Task", refId: t.id },
        ),
      ),
    );
    summary.tasksOverdue += 1;
  }

  // Lembrete de RSVP (guest-facing) — opcional, só quando o casal habilita.
  const cfg = await getEventConfig();
  if (cfg.rsvpReminderEnabled) {
    const baseUrl =
      process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3005";
    const days = Math.max(1, cfg.rsvpReminderDays);
    const [groups, ungroupedGuests] = await Promise.all([
      prisma.guestGroup.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          contactName: true,
          contactPhone: true,
          contactEmail: true,
          rsvpToken: true,
          createdAt: true,
          guests: {
            where: { deletedAt: null },
            orderBy: { name: "asc" },
            select: { name: true, phone: true, email: true, rsvpStatus: true },
          },
        },
      }),
      prisma.guest.findMany({
        where: { deletedAt: null, groupId: null, rsvpStatus: "INVITED" },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          language: true,
          rsvpStatus: true,
          rsvpToken: true,
          createdAt: true,
        },
      }),
    ]);

    const targets = selectRsvpReminderTargets({
      groups,
      guests: ungroupedGuests,
      days,
      today,
      defaultLocale: cfg.defaultLocale,
      alreadySent: sentSet,
    });

    for (const target of targets) {
      const rsvpUrl =
        target.refType === "GuestGroup"
          ? `${baseUrl}/rsvp/group/${target.token}`
          : `${baseUrl}/rsvp/${target.token}`;
      const renderInput =
        target.kind === "RSVP_REMINDER_GROUP"
          ? {
              kind: "RSVP_REMINDER_GROUP" as const,
              userName: target.name,
              memberNames: target.memberNames,
              rsvpUrl,
              daysInvitedSince: target.daysInvitedSince,
            }
          : {
              kind: "RSVP_REMINDER" as const,
              userName: target.name,
              rsvpUrl,
              daysInvitedSince: target.daysInvitedSince,
            };
      await notify(
        { email: target.email, phone: target.phone, locale: target.locale },
        renderInput,
        { refType: target.refType, refId: target.refId },
      );
      summary.rsvpReminders += 1;
    }
  }

  return NextResponse.json({ ok: true, summary });
}

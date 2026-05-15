import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { buildICS } from "@/lib/ics";
import { getEventConfig } from "@/lib/event-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const cfg = await getEventConfig();
  const [tasks, payments] = await Promise.all([
    prisma.task.findMany({
      where: { deletedAt: null, deadline: { not: null } },
      include: { vendor: true, venue: true },
    }),
    prisma.payment.findMany({
      where: { deletedAt: null },
      include: { vendor: true },
    }),
  ]);

  const events = [
    ...(cfg.eventDate
      ? [
          {
            uid: `event-day-${cfg.eventDate.toISOString()}`,
            summary: cfg.coupleNames ? `Casamento ${cfg.coupleNames}` : "Casamento",
            date: cfg.eventDate,
            allDay: true,
          },
        ]
      : []),
    ...tasks
      .filter((t) => t.deadline)
      .map((t) => ({
        uid: `task-${t.id}`,
        summary: `📋 ${t.title}`,
        description: [
          t.description ?? null,
          t.responsible ? `Responsável: ${t.responsible}` : null,
          t.vendor ? `Fornecedor: ${t.vendor.name}` : null,
          t.venue ? `Local: ${t.venue.name}` : null,
        ]
          .filter(Boolean)
          .join("\n") || null,
        date: t.deadline as Date,
        allDay: true,
      })),
    ...payments.map((p) => ({
      uid: `payment-${p.id}`,
      summary: `💸 ${p.vendor.name} — R$ ${p.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      description: `${p.status === "PAID" ? "Pago" : "Pendente"} · ${p.method ?? "—"}`,
      date: p.dueDate,
      allDay: true,
    })),
  ];

  const ics = buildICS(events, "Wedding Finance");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wedding-finance.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}

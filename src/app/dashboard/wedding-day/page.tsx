import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEventConfig, daysUntil } from "@/lib/event-config";
import WeddingDayClient from "./wedding-day-client";

export const dynamic = "force-dynamic";

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export default async function WeddingDayPage() {
  const cfg = await getEventConfig();
  if (!cfg.eventDate) redirect("/dashboard/onboarding");

  const eventDate = cfg.eventDate;
  const dayStart = startOfDay(eventDate);
  const dayEnd = endOfDay(eventDate);

  const [tasksToday, paymentsToday, criticalVendors, guestStats] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null,
        deadline: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { priority: "desc" },
    }),
    prisma.payment.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: dayStart, lte: dayEnd },
      },
      include: { vendor: true },
    }),
    prisma.vendor.findMany({
      where: {
        deletedAt: null,
        status: { in: ["CONTRACTED", "FINALIZED"] },
      },
      include: {
        contacts: { where: { deletedAt: null, isPrimary: true }, take: 1 },
      },
      orderBy: { name: "asc" },
    }),
    prisma.guest.groupBy({
      by: ["rsvpStatus"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const allGuests = await prisma.guest.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, rsvpStatus: true, checkedInAt: true, plusOnesConfirmed: true, isChild: true },
    orderBy: { name: "asc" },
  });

  return (
    <WeddingDayClient
      eventDate={eventDate}
      daysToEvent={daysUntil(eventDate)}
      coupleNames={cfg.coupleNames}
      rainPlanB={null}
      daySchedule={null}
      daySpecialNotes={null}
      settings={await prisma.eventSettings.findUnique({ where: { id: "singleton" } })}
      tasksToday={tasksToday}
      paymentsToday={paymentsToday}
      criticalVendors={criticalVendors.map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
        contactName: v.contacts[0]?.name ?? null,
        contactPhone: v.contacts[0]?.phone ?? null,
      }))}
      guestStats={guestStats}
      guests={allGuests}
    />
  );
}

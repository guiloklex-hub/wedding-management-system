import { prisma } from "@/lib/prisma";
import VenuesClient from "./venues-client";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const venues = await prisma.venue.findMany({
    where: { deletedAt: null },
    include: {
      _count: { select: { checklistItems: true, attachments: { where: { deletedAt: null } } } },
      checklistItems: { select: { checked: true } },
    },
    orderBy: [{ isShortlisted: "desc" }, { createdAt: "desc" }],
  });

  const decorated = venues.map((v) => {
    const total = v.checklistItems.length;
    const done = v.checklistItems.filter((i) => i.checked).length;
    return {
      id: v.id,
      name: v.name,
      address: v.address,
      capacitySeated: v.capacitySeated,
      capacityStanding: v.capacityStanding,
      baseRate: v.baseRate,
      visitedAt: v.visitedAt,
      isShortlisted: v.isShortlisted,
      attachmentCount: v._count.attachments,
      checklistTotal: total,
      checklistDone: done,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Locais / Venues</h1>
        <p className="text-sm text-zinc-500">
          Compare candidatos, anote pros e contras e mantenha o checklist da visita.
        </p>
      </div>
      <VenuesClient venues={decorated} />
    </div>
  );
}

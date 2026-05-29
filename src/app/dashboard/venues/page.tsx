import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import VenuesClient from "./venues-client";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const t = await getTranslations("dashboard.venues");
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
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("page.title")}</h1>
        <p className="text-sm text-zinc-500">{t("page.subtitle")}</p>
      </div>
      <VenuesClient venues={decorated} />
    </div>
  );
}

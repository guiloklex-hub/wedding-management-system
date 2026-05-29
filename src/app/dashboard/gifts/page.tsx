import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import GiftsClient from "./gifts-client";

export const dynamic = "force-dynamic";

export default async function GiftsPage() {
  const t = await getTranslations("dashboard.gifts");
  const [gifts, guests] = await Promise.all([
    prisma.gift.findMany({
      where: { deletedAt: null },
      include: { guest: { select: { id: true, name: true } } },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.guest.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("page.title")}</h1>
        <p className="text-sm text-zinc-500">{t("page.subtitle")}</p>
      </div>
      <GiftsClient gifts={gifts} guests={guests} />
    </div>
  );
}

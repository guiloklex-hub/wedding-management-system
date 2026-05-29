import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import TrousseauClient from "./trousseau-client";

export const dynamic = "force-dynamic";

export default async function TrousseauPage() {
  const t = await getTranslations("dashboard.trousseau");
  const items = await prisma.trousseauItem.findMany({
    where: { deletedAt: null },
    orderBy: [{ priority: "asc" }, { room: "asc" }, { title: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("page.title")}</h1>
        <p className="text-sm text-zinc-500">{t("page.subtitle")}</p>
      </div>
      <TrousseauClient items={items} />
    </div>
  );
}

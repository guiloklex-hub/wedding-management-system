import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import GuestsClient from "./guests-client";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const t = await getTranslations("dashboard.guests");
  const guests = await prisma.guest.findMany({
    where: { deletedAt: null },
    orderBy: [{ rsvpStatus: "asc" }, { name: "asc" }],
  });

  const h = await headers();
  const host = h.get("host") ?? "localhost:3005";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("page.title")}</h1>
        <p className="text-sm text-zinc-500">{t("page.subtitle")}</p>
      </div>
      <GuestsClient guests={guests} baseUrl={baseUrl} />
    </div>
  );
}

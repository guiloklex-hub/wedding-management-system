import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { buildGuestsAnalytics } from "@/lib/reports/guests-analytics";
import { GuestsReportClient } from "./guests-report-client";

export const dynamic = "force-dynamic";

export default async function GuestsReportPage() {
  const t = await getTranslations("dashboard.reports.guests");
  const [guests, groups] = await Promise.all([
    prisma.guest.findMany({
      where: { deletedAt: null },
      select: {
        rsvpStatus: true,
        plusOnesAllowed: true,
        plusOnesConfirmed: true,
        isChild: true,
        isVIP: true,
        isPadrinho: true,
        city: true,
        groupId: true,
      },
    }),
    prisma.guestGroup.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);

  const result = buildGuestsAnalytics(guests, groups);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <ChevronLeft className="h-3 w-3" />
          {t("back")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <GuestsReportClient result={result} />
    </div>
  );
}

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewSensitiveFinance } from "@/lib/permissions";
import { buildHoneymoonProgress } from "@/lib/reports/honeymoon-progress";
import { HoneymoonReportClient } from "./honeymoon-report-client";

export const dynamic = "force-dynamic";

export default async function HoneymoonReportPage() {
  const session = await auth();
  const t = await getTranslations("dashboard.reports.honeymoon");
  const role = (session?.user as { role?: string } | undefined)?.role;
  const finance = canViewSensitiveFinance(role);
  if (!finance) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <h1 className="text-lg font-semibold text-zinc-100">{t("noPermission.title")}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t("noPermission.body")}</p>
      </div>
    );
  }

  const [honeymoon, items, gifts] = await Promise.all([
    prisma.honeymoon.findFirst(),
    prisma.honeymoonItem.findMany({ where: { deletedAt: null } }),
    prisma.gift.findMany({
      where: { deletedAt: null, isHoneymoonShare: true },
      select: { type: true, amount: true, isHoneymoonShare: true },
    }),
  ]);

  const result = buildHoneymoonProgress(honeymoon, items, gifts);

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

      <HoneymoonReportClient result={result} />
    </div>
  );
}

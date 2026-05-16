import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewSensitiveFinance } from "@/lib/permissions";
import { buildGiftsAnalytics } from "@/lib/reports/gifts-analytics";
import { GiftsReportClient } from "./gifts-report-client";

export const dynamic = "force-dynamic";

export default async function GiftsReportPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const finance = canViewSensitiveFinance(role);

  const gifts = await prisma.gift.findMany({
    where: { deletedAt: null },
    include: { guest: { select: { name: true } } },
  });

  const result = buildGiftsAnalytics(
    gifts.map((g) => ({
      type: g.type,
      amount: g.amount,
      receivedAt: g.receivedAt,
      thankedAt: g.thankedAt,
      pixPaidAt: g.pixPaidAt,
      isHoneymoonShare: g.isHoneymoonShare,
      guestId: g.guestId,
      guest: g.guest ? { name: g.guest.name } : null,
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <ChevronLeft className="h-3 w-3" />
          Voltar para relatórios
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Presentes</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Análise de presentes recebidos: dinheiro vs itens, agradecimentos pendentes,
          cota da lua de mel e top givers.
        </p>
      </div>

      <GiftsReportClient result={result} showFinance={finance} />
    </div>
  );
}

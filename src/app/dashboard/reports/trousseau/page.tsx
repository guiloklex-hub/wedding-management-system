import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewSensitiveFinance } from "@/lib/permissions";
import { buildTrousseauProgress } from "@/lib/reports/trousseau-progress";
import { TrousseauReportClient } from "./trousseau-report-client";

export const dynamic = "force-dynamic";

export default async function TrousseauReportPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const finance = canViewSensitiveFinance(role);

  const items = await prisma.trousseauItem.findMany({ where: { deletedAt: null } });
  const result = buildTrousseauProgress(items);

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
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Enxoval</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Progresso por cômodo e itens essenciais ainda pendentes.
        </p>
      </div>

      <TrousseauReportClient result={result} showFinance={finance} />
    </div>
  );
}

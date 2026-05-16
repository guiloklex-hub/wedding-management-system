import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resolveCategoryLabel } from "@/lib/categories";
import { buildVendorFunnel } from "@/lib/reports/vendor-funnel";
import { FunnelClient } from "./funnel-client";

export const dynamic = "force-dynamic";

export default async function VendorFunnelPage() {
  const vendors = await prisma.vendor.findMany({
    where: { deletedAt: null },
    include: { contracts: { where: { deletedAt: null }, select: { signedAt: true, createdAt: true } } },
  });

  const result = buildVendorFunnel(
    vendors.map((v) => ({
      status: v.status,
      categoryKey: v.categoryKey,
      category: v.category,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      contracts: v.contracts,
    })),
    resolveCategoryLabel,
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
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Funil de Fornecedores</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Distribuição por estágio e tempo médio entre negociação, contrato e finalização.
        </p>
      </div>

      <FunnelClient result={result} />
    </div>
  );
}

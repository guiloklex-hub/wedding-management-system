import { prisma } from "@/lib/prisma";
import { requireFinanceAccess } from "@/lib/finance-access";
import AssetsClient from "./assets-client";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  await requireFinanceAccess();

  const [assets, goals] = await Promise.all([
    prisma.asset.findMany({
      where: { deletedAt: null },
      include: { goal: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.savingsGoal.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Caixa (Dinheiro Guardado)</h1>
      </div>
      <AssetsClient assets={assets} goals={goals} />
    </div>
  );
}

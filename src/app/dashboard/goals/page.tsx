import { prisma } from "@/lib/prisma";
import { requireFinanceAccess } from "@/lib/finance-access";
import GoalsClient from "./goals-client";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  await requireFinanceAccess();

  const goals = await prisma.savingsGoal.findMany({
    where: { deletedAt: null },
    include: { assets: { where: { deletedAt: null } } },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  const decorated = goals.map((g) => {
    const current = g.assets.reduce((s, a) => s + a.amount, 0);
    return {
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      targetDate: g.targetDate,
      notes: g.notes,
      imageUrl: g.imageUrl,
      isActive: g.isActive,
      current,
      assetCount: g.assets.length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Metas de poupança</h1>
        <p className="text-sm text-zinc-500">
          Defina quanto guardar até quando. Os aportes (caixa) podem ser vinculados a uma meta.
        </p>
      </div>
      <GoalsClient goals={decorated} />
    </div>
  );
}

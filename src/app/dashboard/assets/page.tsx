import { prisma } from "@/lib/prisma";
import AssetsClient from "./assets-client";

export const dynamic = "force-dynamic";


export default async function AssetsPage() {
  const assets = await prisma.asset.findMany({
    where: { deletedAt: null },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Caixa (Dinheiro Guardado)</h1>
      </div>
      <AssetsClient assets={assets} />
    </div>
  );
}

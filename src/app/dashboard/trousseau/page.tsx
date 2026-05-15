import { prisma } from "@/lib/prisma";
import TrousseauClient from "./trousseau-client";

export const dynamic = "force-dynamic";

export default async function TrousseauPage() {
  const items = await prisma.trousseauItem.findMany({
    where: { deletedAt: null },
    orderBy: [{ priority: "asc" }, { room: "asc" }, { title: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Enxoval</h1>
        <p className="text-sm text-zinc-500">
          Liste o que falta comprar, marque prioridade e acompanhe o orçamento por cômodo.
        </p>
      </div>
      <TrousseauClient items={items} />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import GiftsClient from "./gifts-client";

export const dynamic = "force-dynamic";

export default async function GiftsPage() {
  const [gifts, guests] = await Promise.all([
    prisma.gift.findMany({
      where: { deletedAt: null },
      include: { guest: { select: { id: true, name: true } } },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.guest.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Presentes recebidos</h1>
        <p className="text-sm text-zinc-500">
          Registre o que recebeu (dinheiro ou item), de quem, e marque quando o agradecimento já foi enviado.
        </p>
      </div>
      <GiftsClient gifts={gifts} guests={guests} />
    </div>
  );
}

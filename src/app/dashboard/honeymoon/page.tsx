import { prisma } from "@/lib/prisma";
import { ensureHoneymoon } from "@/app/actions/honeymoonActions";
import HoneymoonClient from "./honeymoon-client";

export const dynamic = "force-dynamic";

export default async function HoneymoonPage() {
  await ensureHoneymoon();
  const honeymoon = await prisma.honeymoon.findUnique({
    where: { id: "singleton" },
    include: {
      items: { where: { deletedAt: null }, orderBy: [{ startAt: "asc" }, { createdAt: "asc" }] },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Lua de mel</h1>
        <p className="text-sm text-zinc-500">
          Roteiro, reservas, documentos e orçamento da viagem pós-casamento.
        </p>
      </div>
      <HoneymoonClient honeymoon={honeymoon!} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEventConfig } from "@/lib/event-config";
import RsvpForm from "./rsvp-form";

export const dynamic = "force-dynamic";

export default async function PublicRsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const guest = await prisma.guest.findFirst({
    where: { rsvpToken: token, deletedAt: null },
  });
  if (!guest) return notFound();

  const cfg = await getEventConfig();

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-950 via-zinc-950 to-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-rose-500/20 bg-zinc-950/80 p-8 shadow-2xl backdrop-blur">
        <p className="text-center text-xs uppercase tracking-widest text-rose-300">
          {cfg.coupleNames ? cfg.coupleNames : "Convite oficial"}
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold text-white">Oi {guest.name}!</h1>
        <p className="mt-3 text-center text-sm text-zinc-300">
          Você está sendo convidado(a) para o nosso casamento em{" "}
          <span className="font-semibold text-white">
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(
              cfg.eventDate,
            )}
          </span>
          .
        </p>
        <RsvpForm guest={guest} />
      </div>
      <p className="mt-6 text-center text-[11px] text-zinc-600">
        Em caso de dúvidas, contate quem te enviou o link.
      </p>
    </div>
  );
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEventConfig } from "@/lib/event-config";
import { toIsoDate } from "@/lib/format";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const cfg = await getEventConfig();
  const session = await auth();
  const email = session?.user?.email ?? null;

  const me = email
    ? await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          twoFactorEnabled: true,
          twoFactorBackupCodes: true,
        },
      })
    : null;

  const members = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const invites = await prisma.invite.findMany({
    where: { acceptedAt: null, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Ajustes</h1>
        <p className="text-sm text-zinc-500">Configurações do casamento, time e segurança.</p>
      </div>
      <SettingsClient
        initial={{
          eventDate: toIsoDate(cfg.eventDate),
          contingencyPercent: cfg.contingencyPercent,
          currency: cfg.currency,
          coupleNames: cfg.coupleNames ?? "",
        }}
        me={me}
        members={members}
        invites={invites}
      />
    </div>
  );
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEventConfig } from "@/lib/event-config";
import { getSecuritySettings } from "@/lib/security-settings";
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
          lastLoginAt: true,
          passwordUpdatedAt: true,
          mustChangePassword: true,
        },
      })
    : null;

  const members = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      archivedAt: true,
      twoFactorEnabled: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
  });

  const securitySettings = await getSecuritySettings();

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
        pixSettings={{
          pixKey: cfg.pixKey ?? "",
          pixKeyType: cfg.pixKeyType ?? "",
          pixHolderName: cfg.pixHolderName ?? "",
          pixCity: cfg.pixCity ?? "",
        }}
        me={me}
        members={members}
        securitySettings={securitySettings}
      />
    </div>
  );
}

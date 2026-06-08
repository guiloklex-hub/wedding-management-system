import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEventConfig } from "@/lib/event-config";
import { getSecuritySettings } from "@/lib/security-settings";
import { canManageUsers } from "@/lib/permissions";
import { toIsoDate } from "@/lib/format";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = await getTranslations("dashboard.settings");
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

  const notificationLogs = canManageUsers(me?.role)
    ? await prisma.notificationLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          kind: true,
          channel: true,
          targetEmail: true,
          targetPhone: true,
          status: true,
          errorMsg: true,
          createdAt: true,
        },
      })
    : [];

  const auditLogs = canManageUsers(me?.role)
    ? await (async () => {
        const logs = await prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 500,
          select: {
            id: true,
            entity: true,
            entityId: true,
            action: true,
            userId: true,
            createdAt: true,
          },
        });
        const actorIds = [...new Set(logs.map((l) => l.userId).filter((id): id is string => !!id))];
        const actors = actorIds.length
          ? await prisma.user.findMany({
              where: { id: { in: actorIds } },
              select: { id: true, name: true, email: true },
            })
          : [];
        const byId = new Map(actors.map((u) => [u.id, u]));
        return logs.map((l) => {
          const actor = l.userId ? byId.get(l.userId) : undefined;
          return {
            id: l.id,
            entity: l.entity,
            entityId: l.entityId,
            action: l.action,
            createdAt: l.createdAt,
            actorName: actor?.name ?? null,
            actorEmail: actor?.email ?? null,
          };
        });
      })()
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("page.title")}</h1>
        <p className="text-sm text-zinc-500">{t("page.subtitle")}</p>
      </div>
      <SettingsClient
        initial={{
          eventDate: toIsoDate(cfg.eventDate),
          contingencyPercent: cfg.contingencyPercent,
          currency: cfg.currency,
          coupleNames: cfg.coupleNames ?? "",
          rsvpReminderEnabled: cfg.rsvpReminderEnabled,
          rsvpReminderDays: cfg.rsvpReminderDays,
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
        notificationLogs={notificationLogs}
        auditLogs={auditLogs}
      />
    </div>
  );
}

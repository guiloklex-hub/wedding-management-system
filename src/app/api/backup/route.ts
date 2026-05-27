import { hostname } from "node:os";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewSensitiveFinance } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { BACKUP_VERSION, computeChecksum, type BackupPayload } from "@/lib/backup";
import appPkg from "@/../package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userRole = (session.user as { role?: string }).role;
  if (!canViewSensitiveFinance(userRole)) {
    return NextResponse.json({ error: "Sem permissão para esta área" }, { status: 403 });
  }
  const isAdmin = userRole === "ADMIN";

  const [
    eventSettings,
    securitySettings,
    users,
    vendors,
    vendorContacts,
    vendorNotes,
    contracts,
    attachments,
    venues,
    venueChecklistItems,
    budgetItems,
    payments,
    incomes,
    assets,
    savingsGoals,
    honeymoon,
    honeymoonItems,
    trousseauItems,
    guestGroups,
    guests,
    seatingTables,
    gifts,
    tasks,
    notificationLogs,
    auditLogs,
  ] = await Promise.all([
    prisma.eventSettings.findUnique({ where: { id: "singleton" } }),
    prisma.securitySettings.findUnique({ where: { id: "singleton" } }),
    isAdmin
      ? prisma.user.findMany({ orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    prisma.vendor.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.vendorContact.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.vendorNote.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.contract.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.attachment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.venue.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.venueChecklistItem.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.budgetItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.income.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.asset.findMany({ orderBy: { date: "asc" } }),
    prisma.savingsGoal.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.honeymoon.findUnique({ where: { id: "singleton" } }),
    prisma.honeymoonItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.trousseauItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.guestGroup.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.guest.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.seatingTable.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.gift.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({ orderBy: { createdAt: "asc" } }),
    isAdmin
      ? prisma.notificationLog.findMany({ orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    isAdmin
      ? prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);

  const sessionUser = session.user as { id?: string; email?: string | null };

  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    meta: {
      appVersion: appPkg.version,
      hostname: hostname(),
      nodeVersion: process.version,
      exportedBy: sessionUser.id
        ? { id: sessionUser.id, email: sessionUser.email ?? null }
        : undefined,
    },
    eventSettings,
    securitySettings,
    users: isAdmin ? users : undefined,
    vendors,
    vendorContacts,
    vendorNotes,
    contracts,
    attachments,
    venues,
    venueChecklistItems,
    budgetItems,
    payments,
    incomes,
    assets,
    savingsGoals,
    honeymoon,
    honeymoonItems,
    trousseauItems,
    guestGroups,
    guests,
    seatingTables,
    gifts,
    tasks,
    notificationLogs: isAdmin ? notificationLogs : undefined,
    auditLogs: isAdmin ? auditLogs : undefined,
  };

  const checksum = {
    algorithm: "sha256" as const,
    value: computeChecksum(payload),
  };

  const counts: Record<string, number> = {
    vendors: vendors.length,
    vendorContacts: vendorContacts.length,
    vendorNotes: vendorNotes.length,
    contracts: contracts.length,
    attachments: attachments.length,
    venues: venues.length,
    venueChecklistItems: venueChecklistItems.length,
    budgetItems: budgetItems.length,
    payments: payments.length,
    incomes: incomes.length,
    assets: assets.length,
    savingsGoals: savingsGoals.length,
    honeymoonItems: honeymoonItems.length,
    trousseauItems: trousseauItems.length,
    guestGroups: guestGroups.length,
    guests: guests.length,
    seatingTables: seatingTables.length,
    gifts: gifts.length,
    tasks: tasks.length,
  };
  if (isAdmin) {
    counts.users = users.length;
    counts.notificationLogs = notificationLogs.length;
    counts.auditLogs = auditLogs.length;
  }

  await audit(
    "EventSettings",
    "singleton",
    "BACKUP_EXPORT",
    {
      version: BACKUP_VERSION,
      checksum: checksum.value,
      counts,
      includesSensitive: isAdmin,
    },
    sessionUser.id,
  );

  const filename = `wedding-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const body = JSON.stringify({ checksum, payload }, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Backup-Version": String(BACKUP_VERSION),
      "X-Backup-Checksum": checksum.value,
    },
  });
}

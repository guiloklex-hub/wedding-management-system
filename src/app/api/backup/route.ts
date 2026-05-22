import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewSensitiveFinance } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!canViewSensitiveFinance((session.user as { role?: string }).role)) {
    return NextResponse.json({ error: "Sem permissão para esta área" }, { status: 403 });
  }

  const [
    eventSettings,
    securitySettings,
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
  ] = await Promise.all([
    prisma.eventSettings.findUnique({ where: { id: "singleton" } }),
    prisma.securitySettings.findUnique({ where: { id: "singleton" } }),
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
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    eventSettings,
    securitySettings,
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
  };

  await audit(
    "EventSettings",
    "singleton",
    "BACKUP_EXPORT",
    {
      tables: Object.keys(payload).filter(
        (k) => k !== "exportedAt" && k !== "version",
      ),
      counts: {
        vendors: vendors.length,
        contracts: contracts.length,
        attachments: attachments.length,
        venues: venues.length,
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
      },
    },
    (session.user as { id?: string }).id,
  );

  const filename = `wedding-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

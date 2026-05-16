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

  const [eventSettings, vendors, budgetItems, payments, assets] = await Promise.all([
    prisma.eventSettings.findUnique({ where: { id: "singleton" } }),
    prisma.vendor.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.budgetItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.asset.findMany({ orderBy: { date: "asc" } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    eventSettings,
    vendors,
    budgetItems,
    payments,
    assets,
  };

  await audit("EventSettings", "singleton", "BACKUP_EXPORT", {
    tables: ["eventSettings", "vendors", "budgetItems", "payments", "assets"],
    counts: {
      vendors: vendors.length,
      budgetItems: budgetItems.length,
      payments: payments.length,
      assets: assets.length,
    },
  }, (session.user as { id?: string }).id);

  const filename = `wfv-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
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

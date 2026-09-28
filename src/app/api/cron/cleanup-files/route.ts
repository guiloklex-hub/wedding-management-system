import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEquals } from "@/lib/timing-safe";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RETENTION_DAYS = 30;

type Summary = {
  softDeletedHardRemoved: number;
  orphanFilesRemoved: number;
  retainedSoftDeleted: number;
  errors: number;
};

export async function GET(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req.headers);
  if (!rateLimit(`cron-cleanup:${ip}`, 5, 60_000).ok) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "CRON_SECRET não configurado" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!timingSafeEquals(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const summary: Summary = {
    softDeletedHardRemoved: 0,
    orphanFilesRemoved: 0,
    retainedSoftDeleted: 0,
    errors: 0,
  };

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);

  try {
    summary.retainedSoftDeleted = await prisma.attachment.count({
      where: { deletedAt: { not: null, lt: cutoff } },
    });

  } catch (err) {
    console.error("[cron/cleanup-files] fatal", err);
    return NextResponse.json({ message: "Falha no cleanup", summary }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary });
}

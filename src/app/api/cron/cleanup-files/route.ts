import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEquals } from "@/lib/timing-safe";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { listAllUploads, removeUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

const RETENTION_DAYS = 30;

type Summary = {
  softDeletedHardRemoved: number;
  orphanFilesRemoved: number;
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
    errors: 0,
  };

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);

  try {
    const expired = await prisma.attachment.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      select: { id: true, storagePath: true },
    });
    for (const att of expired) {
      try {
        await removeUpload(att.storagePath);
        await prisma.attachment.delete({ where: { id: att.id } });
        summary.softDeletedHardRemoved += 1;
      } catch (err) {
        console.error("[cron/cleanup-files] expired", att.id, err);
        summary.errors += 1;
      }
    }

    const onDisk = await listAllUploads();
    if (onDisk.length > 0) {
      const knownPaths = new Set(
        (
          await prisma.attachment.findMany({
            select: { storagePath: true },
          })
        ).map((a) => a.storagePath),
      );
      for (const rel of onDisk) {
        if (!knownPaths.has(rel)) {
          try {
            await removeUpload(rel);
            summary.orphanFilesRemoved += 1;
          } catch (err) {
            console.error("[cron/cleanup-files] orphan", rel, err);
            summary.errors += 1;
          }
        }
      }
    }
  } catch (err) {
    console.error("[cron/cleanup-files] fatal", err);
    return NextResponse.json({ message: "Falha no cleanup", summary }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary });
}

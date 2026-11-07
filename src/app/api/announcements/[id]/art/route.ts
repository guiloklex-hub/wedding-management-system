import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readUpload } from "@/lib/storage";
import { canEdit } from "@/lib/permissions";
import { AnnouncementIdSchema, parseAnnouncementPayload } from "@/lib/notifications/announcement-config";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!canEdit((session.user as { role?: string }).role)) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  const { id } = await params;
  const parsedId = AnnouncementIdSchema.safeParse(id);
  if (!parsedId.success) return new NextResponse(null, { status: 404 });

  const row = await prisma.broadcast.findFirst({
    where: { id: parsedId.data, kind: "ANNOUNCEMENT" },
    select: { payloadJson: true },
  });
  const art = parseAnnouncementPayload(row?.payloadJson)?.config.art;
  if (!art) return new NextResponse(null, { status: 404 });

  try {
    const data = await readUpload(art.path);
    const filename = art.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": art.mime,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[api/announcements/art] falha ao ler a arte", err);
    return new NextResponse(null, { status: 404 });
  }
}

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canViewAttachmentKind, canManageContract } from "@/lib/permissions";
import { readUpload } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id;

  const { id } = await params;

  const ip = getClientIp(await headers());
  if (!rateLimit(`download:${userId ?? "anon"}:${id}`, 20, 60_000).ok) {
    return NextResponse.json({ error: "Muitos downloads em sequência." }, { status: 429 });
  }
  if (!rateLimit(`download:ip:${ip}`, 120, 60_000).ok) {
    return NextResponse.json({ error: "Limite de downloads excedido." }, { status: 429 });
  }

  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att || (att.deletedAt && !canManageContract(role))) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  if (!canViewAttachmentKind(role, att.kind)) {
    return NextResponse.json({ error: "Sem permissão para este anexo" }, { status: 403 });
  }

  let body: Buffer;
  try {
    body = await readUpload(att.storagePath);
  } catch (err) {
    console.error("[files] read failed", err);
    return NextResponse.json({ error: "Arquivo não disponível" }, { status: 404 });
  }

  await audit(
    "Attachment",
    att.id,
    "DOWNLOAD",
    { kind: att.kind, contractId: att.contractId, vendorId: att.vendorId },
    userId,
  );

  const isContract = att.kind === "CONTRACT";
  const isInlineable = att.mimeType.startsWith("image/") || att.mimeType === "application/pdf";
  const disposition = isInlineable ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `${disposition}; filename="${att.filename}"`,
      "Cache-Control": isContract ? "private, no-store" : "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox; style-src 'unsafe-inline'",
      "Referrer-Policy": "no-referrer",
    },
  });
}

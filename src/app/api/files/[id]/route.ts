import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const att = await prisma.attachment.findFirst({ where: { id, deletedAt: null } });
  if (!att) return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });

  let body: Buffer;
  try {
    body = await readUpload(att.storagePath);
  } catch (err) {
    console.error("[files] read failed", err);
    return NextResponse.json({ error: "Arquivo não disponível" }, { status: 404 });
  }

  const disposition = att.mimeType.startsWith("image/") || att.mimeType === "application/pdf" ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `${disposition}; filename="${att.filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

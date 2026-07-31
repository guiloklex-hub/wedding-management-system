import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEventConfig } from "@/lib/event-config";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const cfg = await getEventConfig();
  if (!cfg.invitationFilePath || !cfg.invitationFileMime) {
    return new NextResponse("Arte não encontrada", { status: 404 });
  }

  try {
    const fileBuffer = await readUpload(cfg.invitationFilePath);
    const sanitizedFilename = (cfg.invitationFileName || "invitation")
      .replace(/[^a-zA-Z0-9_.-]/g, "_");

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": cfg.invitationFileMime,
        "Content-Disposition": `inline; filename="${sanitizedFilename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[api/invitations/art] Falha ao ler arquivo de arte:", err);
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }
}

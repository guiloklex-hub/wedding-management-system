import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const cfg = await prisma.eventSettings.findUnique({
    where: { id: "singleton" },
    select: { saveTheDateFilePath: true, saveTheDateFileMime: true, saveTheDateFileName: true },
  });
  if (!cfg?.saveTheDateFilePath || !cfg.saveTheDateFileMime) {
    return NextResponse.json({ error: "Sem arte" }, { status: 404 });
  }

  try {
    const bytes = await readUpload(cfg.saveTheDateFilePath);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": cfg.saveTheDateFileMime,
        "Content-Disposition": `inline; filename="${cfg.saveTheDateFileName ?? "save-the-date"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Sem arte" }, { status: 404 });
  }
}

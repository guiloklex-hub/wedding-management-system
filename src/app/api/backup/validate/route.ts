import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { canViewSensitiveFinance } from "@/lib/permissions";
import { parseBackupText, BACKUP_VERSION } from "@/lib/backup";

export const dynamic = "force-dynamic";

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (!canViewSensitiveFinance(role)) {
    return NextResponse.json({ error: "Sem permissão para esta área" }, { status: 403 });
  }

  let text: string;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      text = await req.text();
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Envie o arquivo de backup no campo `file`." },
          { status: 400 },
        );
      }
      if (file.size > MAX_BACKUP_BYTES) {
        return NextResponse.json(
          { error: `Arquivo muito grande (máximo ${MAX_BACKUP_BYTES / 1024 / 1024} MB).` },
          { status: 413 },
        );
      }
      text = await file.text();
    } else {
      return NextResponse.json(
        { error: "Envie JSON cru ou multipart/form-data com campo `file`." },
        { status: 415 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao ler corpo: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (text.length > MAX_BACKUP_BYTES) {
    return NextResponse.json(
      { error: "Conteúdo excede o tamanho máximo permitido." },
      { status: 413 },
    );
  }

  try {
    const result = parseBackupText(text);
    return NextResponse.json({
      ok: true,
      version: result.payload.version,
      systemVersion: BACKUP_VERSION,
      exportedAt: result.payload.exportedAt,
      meta: result.payload.meta ?? null,
      checksumValid: result.checksumValid,
      checksum: result.checksum ?? null,
      counts: result.counts,
      warnings: result.warnings,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Estrutura do backup inválida",
          issues: err.issues.slice(0, 20).map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 422 },
    );
  }
}

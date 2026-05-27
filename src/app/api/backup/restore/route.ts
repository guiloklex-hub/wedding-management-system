import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { BACKUP_VERSION, parseBackupText } from "@/lib/backup";
import { restoreBackup } from "@/lib/backup-restore";

export const dynamic = "force-dynamic";

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  const sessionUser = session?.user as
    | { id?: string; role?: string; email?: string | null }
    | undefined;

  if (!sessionUser?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (sessionUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Apenas administradores podem restaurar backup." },
      { status: 403 },
    );
  }

  const ip = getClientIp(req.headers);
  const limit = rateLimit(`backup-restore:${sessionUser.id}:${ip}`, 3, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas de restauração. Aguarde antes de tentar novamente." },
      { status: 429 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Envie multipart/form-data com `file`, `password` e `confirm`." },
      { status: 415 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao ler formulário: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const password = form.get("password");
  const confirm = form.get("confirm");

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json(
      { error: "Confirme sua senha para autorizar a restauração." },
      { status: 400 },
    );
  }
  if (confirm !== "WIPE_AND_RESTORE") {
    return NextResponse.json(
      { error: "Marque a confirmação explícita para prosseguir." },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Envie o arquivo de backup no campo `file`." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
  }
  if (file.size > MAX_BACKUP_BYTES) {
    return NextResponse.json(
      { error: `Arquivo muito grande (máximo ${MAX_BACKUP_BYTES / 1024 / 1024} MB).` },
      { status: 413 },
    );
  }

  const dbUser = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!dbUser || !dbUser.isActive || dbUser.archivedAt) {
    return NextResponse.json({ error: "Conta inválida." }, { status: 403 });
  }
  const match = await bcrypt.compare(password, dbUser.password);
  if (!match) {
    return NextResponse.json(
      { error: "Senha incorreta." },
      { status: 401 },
    );
  }

  let text: string;
  try {
    text = await file.text();
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao ler arquivo: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = parseBackupText(text);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Estrutura do backup inválida.",
          issues: err.issues.slice(0, 20).map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 422 },
    );
  }

  if (parsed.checksumValid === false) {
    return NextResponse.json(
      {
        error:
          "Checksum do backup inválido. O arquivo pode ter sido alterado — restauração bloqueada por segurança.",
      },
      { status: 422 },
    );
  }

  const protectUserId =
    Array.isArray(parsed.payload.users) &&
    parsed.payload.users.length > 0 &&
    !parsed.payload.users.some((u) => u.id === sessionUser.id)
      ? sessionUser.id
      : undefined;

  let counts;
  try {
    counts = await restoreBackup(parsed.payload, { protectUserId });
  } catch (err) {
    console.error("[backup/restore] falha:", err);
    return NextResponse.json(
      {
        error: `Falha ao restaurar: ${(err as Error).message}. Nenhuma alteração foi commitada.`,
      },
      { status: 500 },
    );
  }

  await audit(
    "EventSettings",
    "singleton",
    "BACKUP_RESTORE",
    {
      version: parsed.payload.version,
      systemVersion: BACKUP_VERSION,
      exportedAt: parsed.payload.exportedAt,
      checksum: parsed.checksum?.value ?? null,
      counts,
      protectedCurrentUser: protectUserId !== undefined,
      warnings: parsed.warnings,
    },
    sessionUser.id,
  );

  return NextResponse.json({
    ok: true,
    counts,
    warnings: parsed.warnings,
    protectedCurrentUser: protectUserId !== undefined,
  });
}

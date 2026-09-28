import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { restorePortable } from "@/lib/portable-restore";
import { savePortableUpload } from "@/lib/portable-upload";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const t = await getTranslations("dashboard.settings.backup.portable");
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "ADMIN") {
    return NextResponse.json({ error: t("adminOnly") }, { status: 403 });
  }
  const rate = rateLimit(`portable-restore:${user.id}:${getClientIp(request.headers)}`, 3, 60 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: t("rateLimited") }, { status: 429 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const backupPassword = form?.get("backupPassword");
  const accountPassword = form?.get("accountPassword");
  if (!(file instanceof File) || typeof backupPassword !== "string" ||
      typeof accountPassword !== "string" || form?.get("confirm") !== "REPLACE_ALL") {
    return NextResponse.json({ error: t("restoreInput") }, { status: 400 });
  }
  const account = await prisma.user.findUnique({ where: { id: user.id } });
  if (!account?.isActive || account.archivedAt || !await bcrypt.compare(accountPassword, account.password)) {
    return NextResponse.json({ error: t("accountPasswordInvalid") }, { status: 401 });
  }
  const upload = await savePortableUpload(file);
  try {
    const preview = await restorePortable(upload.path, backupPassword);
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    console.error("[backup/portable-restore] falha:", error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 422 });
  } finally { await upload.dispose(); }
}

import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { inspectPortable } from "@/lib/portable-inspect";
import { savePortableUpload } from "@/lib/portable-upload";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const t = await getTranslations("dashboard.settings.backup.portable");
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: t("adminOnly") }, { status: 403 });
  }
  const rate = rateLimit(`portable-validate:${getClientIp(request.headers)}`, 8, 60 * 60_000);
  if (!rate.ok) return NextResponse.json({ error: t("rateLimited") }, { status: 429 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const password = form?.get("backupPassword");
  if (!(file instanceof File) || typeof password !== "string" || !password) {
    return NextResponse.json({ error: t("validateInput") }, { status: 400 });
  }
  const upload = await savePortableUpload(file);
  try {
    const preview = await inspectPortable(upload.path, password, async ({ preview }) => preview);
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 422 });
  } finally { await upload.dispose(); }
}

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import type { ActionResult } from "@/types";

const Schema = z.object({
  locale: z.enum(LOCALES),
});

export async function updateLocale(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.profile");
  const tc = await getTranslations("actions.common");

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: tc("unauthorized") };

  const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: t("invalidLocale") };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { locale: parsed.data.locale },
    });
    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, parsed.data.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    await audit("User", userId, "UPDATE", { locale: parsed.data.locale });
    return { success: true, data: { locale: parsed.data.locale as Locale } };
  } catch (err) {
    console.error("[updateLocale]", err);
    return { success: false, error: t("errorSaving") };
  }
}

const EmailSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  email: z.string().trim().toLowerCase().email().max(160),
});

export async function updateOwnEmail(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.profile");
  const tc = await getTranslations("actions.common");

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: tc("unauthorized") };

  const parsed = EmailSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: t("invalidEmail") };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: tc("unauthorized") };

    const ok = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!ok) return { success: false, error: t("wrongPassword") };

    if (parsed.data.email !== user.email) {
      const owner = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true },
      });
      if (owner && owner.id !== user.id) {
        return { success: false, error: t("emailTaken") };
      }
    }

    await prisma.user.update({ where: { id: userId }, data: { email: parsed.data.email } });
    await audit("User", userId, "UPDATE", { changes: { email: parsed.data.email }, self: true });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");
    return { success: true };
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
      return { success: false, error: t("emailTaken") };
    }
    console.error("[updateOwnEmail]", err);
    return { success: false, error: t("errorSaving") };
  }
}

"use server";

import { cookies } from "next/headers";
import { z } from "zod";
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

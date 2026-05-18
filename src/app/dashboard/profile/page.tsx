import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { coerceLocale } from "@/i18n/config";
import ProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, locale: true },
  });
  if (!user) redirect("/login");

  const t = await getTranslations("common.nav");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">{t("profile")}</h1>
      </header>
      <ProfileClient
        initial={{
          name: user.name ?? "",
          email: user.email,
          locale: coerceLocale(user.locale),
        }}
      />
    </div>
  );
}

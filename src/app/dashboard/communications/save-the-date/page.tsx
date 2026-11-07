import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEventConfig } from "@/lib/event-config";
import { getWhatsAppStatus } from "@/lib/notifications/whatsapp";
import {
  getActiveSaveTheDateBroadcast,
  getSaveTheDateRecipients,
} from "@/app/actions/saveTheDateActions";
import { coerceLocale } from "@/i18n/config";
import { formatDate } from "@/lib/format";
import SaveTheDateClient from "./save-the-date-client";

export const dynamic = "force-dynamic";

export default async function SaveTheDatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const t = await getTranslations("dashboard.saveTheDate");
  const locale = coerceLocale(await getLocale());
  const cfg = await getEventConfig();

  const [tags, venue, user, active, recipients] = await Promise.all([
    prisma.guestTag.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.venue.findFirst({
      where: { deletedAt: null },
      orderBy: [{ isShortlisted: "desc" }, { createdAt: "asc" }],
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, email: true },
    }),
    getActiveSaveTheDateBroadcast(),
    getSaveTheDateRecipients(true),
  ]);

  const list = recipients ?? [];
  const eligible = list.filter((r) => r.status === "PENDING").length;
  const skipped = list.length - eligible;
  const sampleNames = list.find((r) => r.status === "PENDING")?.memberNames ?? null;

  let savedExcludeTagIds: string[] = [];
  if (cfg.saveTheDateExcludeTagIds) {
    try {
      const parsed = JSON.parse(cfg.saveTheDateExcludeTagIds);
      if (Array.isArray(parsed)) savedExcludeTagIds = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      savedExcludeTagIds = [];
    }
  }

  const eventDateStr = cfg.eventDate
    ? formatDate(cfg.eventDate, locale, {
        timeZone: "UTC",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("page.title")}</h1>
        <p className="text-sm text-zinc-500">{t("page.subtitle")}</p>
      </div>
      <SaveTheDateClient
        config={{
          weddingWebsiteUrl: cfg.weddingWebsiteUrl ?? "",
          giftRegistryUrl: cfg.giftRegistryUrl ?? "",
          saveTheDateMessage: cfg.saveTheDateMessage ?? "",
          hasArt: Boolean(cfg.saveTheDateFilePath),
          artName: cfg.saveTheDateFileName ?? null,
          artIsImage: (cfg.saveTheDateFileMime ?? "").startsWith("image/"),
          excludeTagIds: savedExcludeTagIds,
          excludePadrinhos: cfg.saveTheDateExcludePadrinhos,
        }}
        tags={tags}
        event={{
          coupleNames: cfg.coupleNames ?? "",
          eventDateStr,
          venueName: venue?.name ?? null,
          configured: Boolean(cfg.eventDate && cfg.coupleNames),
        }}
        recipients={{ eligible, skipped, sampleNames, list }}
        capabilities={{
          whatsappConnected: getWhatsAppStatus().state === "CONNECTED",
          hasUserPhone: Boolean(user?.phone),
          hasUserEmail: Boolean(user?.email),
        }}
        activeBroadcast={active}
      />
    </div>
  );
}

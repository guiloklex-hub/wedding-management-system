import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Mail, Megaphone, Send } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

type HubEntry = {
  key: "saveTheDate" | "invitations" | "announcements";
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ENTRIES: HubEntry[] = [
  { key: "saveTheDate", href: "/dashboard/communications/save-the-date", icon: Send },
  { key: "invitations", href: "/dashboard/communications/invitations", icon: Mail },
  { key: "announcements", href: "/dashboard/communications/announcements", icon: Megaphone },
];

async function latestBroadcastStatus(kind: "SAVE_THE_DATE" | "OFFICIAL_INVITATION") {
  const latest = await prisma.broadcast.findFirst({
    where: { kind, status: { not: "DRAFT" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, total: true },
  });
  if (!latest) return null;
  const sent = await prisma.broadcastRecipient.count({
    where: { broadcastId: latest.id, status: "SENT" },
  });
  return { status: latest.status, total: latest.total, sent };
}

export default async function CommunicationsHubPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  if (!canEdit(role)) redirect("/dashboard");

  const t = await getTranslations("dashboard.communications.hub");
  const locale = (await getLocale()) as Locale;

  const [std, invitation, announcementGroups, lastAnnouncement] = await Promise.all([
    latestBroadcastStatus("SAVE_THE_DATE"),
    latestBroadcastStatus("OFFICIAL_INVITATION"),
    prisma.broadcast.groupBy({
      by: ["status"],
      where: { kind: "ANNOUNCEMENT" },
      _count: { _all: true },
    }),
    prisma.broadcast.findFirst({
      where: { kind: "ANNOUNCEMENT", status: { not: "DRAFT" }, startedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
  ]);

  const countBy = (status: string) =>
    announcementGroups.find((g) => g.status === status)?._count._all ?? 0;
  const drafts = countBy("DRAFT");
  const sentAnnouncements = countBy("DONE") + countBy("SENDING") + countBy("CANCELLED");

  function broadcastLine(info: Awaited<ReturnType<typeof latestBroadcastStatus>>): string {
    if (!info) return t("status.none");
    return t("status.broadcast", {
      status: t(`status.label.${info.status}`),
      sent: info.sent,
      total: info.total,
    });
  }

  const statusLines: Record<HubEntry["key"], string> = {
    saveTheDate: broadcastLine(std),
    invitations: broadcastLine(invitation),
    announcements: lastAnnouncement?.startedAt
      ? t("status.announcementsWithLast", {
          drafts,
          sent: sentAnnouncements,
          date: formatDate(lastAnnouncement.startedAt, locale),
        })
      : t("status.announcements", { drafts, sent: sentAnnouncements }),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link
              key={entry.key}
              href={entry.href}
              className="group flex h-full items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-sm transition-colors hover:bg-zinc-800/50"
            >
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-2 text-rose-300 group-hover:text-rose-200">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    {t(`items.${entry.key}.title`)}
                  </h2>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-rose-300" />
                </div>
                <p className="mt-2 text-xs text-zinc-400">{t(`items.${entry.key}.description`)}</p>
                <p className="mt-3 inline-flex rounded-full border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-[11px] text-zinc-300">
                  {statusLines[entry.key]}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

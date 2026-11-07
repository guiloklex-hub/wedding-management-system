import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { parseAnnouncementPayload } from "@/lib/notifications/announcement-config";
import { NewAnnouncementButton } from "./_components/new-announcement-button";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  DRAFT: "border-zinc-700 text-zinc-300",
  SENDING: "border-amber-500/40 text-amber-200",
  DONE: "border-emerald-500/40 text-emerald-200",
  CANCELLED: "border-rose-500/40 text-rose-200",
};

export default async function AnnouncementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canEdit((session.user as { role?: string }).role)) redirect("/dashboard");

  const t = await getTranslations("dashboard.announcements");
  const locale = (await getLocale()) as Locale;

  const items = await prisma.broadcast.findMany({
    where: { kind: "ANNOUNCEMENT" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, status: true, channel: true, createdAt: true, startedAt: true, payloadJson: true },
  });
  const counts = items.length
    ? await prisma.broadcastRecipient.groupBy({
        by: ["broadcastId", "status"],
        where: { broadcastId: { in: items.map((i) => i.id) } },
        _count: { _all: true },
      })
    : [];
  const countOf = (id: string, status: string) =>
    counts.find((c) => c.broadcastId === id && c.status === status)?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("list.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{t("list.subtitle")}</p>
        </div>
        <NewAnnouncementButton />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 p-10 text-center">
          <Megaphone className="h-8 w-8 text-rose-300" />
          <p className="text-sm text-zinc-400">{t("list.empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-900 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3">{t("list.colTitle")}</th>
                <th className="px-4 py-3">{t("list.colStatus")}</th>
                <th className="px-4 py-3">{t("list.colChannel")}</th>
                <th className="px-4 py-3">{t("list.colDate")}</th>
                <th className="px-4 py-3">{t("list.colResult")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const payload = parseAnnouncementPayload(item.payloadJson);
                const date = item.startedAt ?? item.createdAt;
                const channel = payload?.config.channel ?? item.channel;
                return (
                  <tr key={item.id} className="border-t border-zinc-800/70 hover:bg-zinc-900/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/communications/announcements/${item.id}`}
                        className="font-medium text-zinc-100 hover:text-rose-200"
                      >
                        {payload?.config.title ?? t("list.untitled")}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[item.status] ?? STATUS_TONE.DRAFT}`}
                      >
                        {t(`status.${item.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{t(`editor.channel.${channel}.label`)}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {item.startedAt ? t("list.sentOn") : t("list.createdOn")} {formatDate(date, locale)}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {item.status === "DRAFT"
                        ? "—"
                        : t("list.result", { sent: countOf(item.id, "SENT"), failed: countOf(item.id, "FAILED") })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

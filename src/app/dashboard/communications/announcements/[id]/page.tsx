import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit, canManageUsers } from "@/lib/permissions";
import { getWhatsAppStatus } from "@/lib/notifications/whatsapp";
import { isEmailConfigured } from "@/lib/notifications/email";
import {
  AnnouncementIdSchema,
  parseAnnouncementPayload,
} from "@/lib/notifications/announcement-config";
import { buildAnnouncementContext, loadAnnouncementSources } from "@/lib/notifications/announcement";
import { getAnnouncementProgress, getAnnouncementRecipients } from "@/app/actions/announcementActions";
import { AnnouncementEditor } from "../_components/announcement-editor";
import { AnnouncementReport } from "../_components/announcement-report";

export const dynamic = "force-dynamic";

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  if (!canEdit(role)) redirect("/dashboard");

  const { id: rawId } = await params;
  const id = AnnouncementIdSchema.safeParse(rawId);
  if (!id.success) notFound();

  const row = await prisma.broadcast.findFirst({
    where: { id: id.data, kind: "ANNOUNCEMENT" },
    select: { id: true, status: true, payloadJson: true },
  });
  const payload = parseAnnouncementPayload(row?.payloadJson);
  if (!row || !payload) notFound();

  const t = await getTranslations("dashboard.announcements");
  const tags = await prisma.guestTag.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
  const { config } = payload;

  const header = (
    <div className="space-y-2">
      <Link
        href="/dashboard/communications/announcements"
        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {t("detail.back")}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{config.title}</h1>
      <p className="text-sm text-zinc-500">
        {row.status === "DRAFT" ? t("detail.draftSubtitle") : t("detail.sentSubtitle")}
      </p>
    </div>
  );

  if (row.status !== "DRAFT") {
    const [progress, recipients] = await Promise.all([
      getAnnouncementProgress(row.id),
      getAnnouncementRecipients(row.id),
    ]);
    if (!progress) notFound();
    return (
      <div className="space-y-6">
        {header}
        <AnnouncementReport
          id={row.id}
          title={config.title}
          message={config.message}
          channel={config.channel}
          audience={config.audience}
          tags={tags}
          hasArt={Boolean(config.art)}
          initialProgress={progress}
          initialRows={recipients ?? []}
          canManage={canManageUsers(role)}
        />
      </div>
    );
  }

  const [sources, context, user] = await Promise.all([
    loadAnnouncementSources(),
    buildAnnouncementContext(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { phone: true, email: true } }),
  ]);
  const waState = getWhatsAppStatus().state;
  const appUrl = context?.appUrl ?? "";

  return (
    <div className="space-y-6">
      {header}
      <AnnouncementEditor
        id={row.id}
        initial={{
          title: config.title,
          message: config.message,
          channel: config.channel,
          audience: config.audience,
          excludedRefs: config.excludedRefs,
          art: config.art ? { name: config.art.name, isImage: config.art.mime.startsWith("image/") } : null,
        }}
        sources={sources}
        tags={tags}
        preview={{
          configured: Boolean(context),
          coupleNames: context?.coupleNames ?? "",
          eventDateIso: context?.eventDate ?? null,
          venueName: context?.venueName ?? null,
          siteUrl: context?.siteUrl ?? null,
          registryUrl: context?.registryUrl ?? null,
          sampleRsvpLink:
            context?.rsvpMode === "EXTERNAL" && context.externalRsvpUrl
              ? context.externalRsvpUrl
              : `${appUrl}/rsvp/…`,
        }}
        defaultLocale={context?.defaultLocale ?? "pt-BR"}
        capabilities={{
          canManage: canManageUsers(role),
          whatsappConnected: waState === "CONNECTED" || waState === "DISCONNECTED",
          emailConfigured: isEmailConfigured(),
          hasUserPhone: Boolean(user?.phone),
          hasUserEmail: Boolean(user?.email),
        }}
      />
    </div>
  );
}

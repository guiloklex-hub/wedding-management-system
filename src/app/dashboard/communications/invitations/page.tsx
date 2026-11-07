import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEventConfig } from "@/lib/event-config";
import { getWhatsAppStatus } from "@/lib/notifications/whatsapp";
import { canEdit, canManageUsers } from "@/lib/permissions";
import {
  getActiveInvitationBroadcast,
  getInvitationRecipients,
} from "@/app/actions/invitationActions";
import InvitationsClient from "./invitations-client";

export const dynamic = "force-dynamic";

export default async function OfficialInvitationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userRole = (session.user as { role?: string }).role;
  if (!canEdit(userRole)) {
    redirect("/dashboard");
  }

  const t = await getTranslations("dashboard.invitations");
  const cfg = await getEventConfig();

  const [tags, user, active, recipients] = await Promise.all([
    prisma.guestTag.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, email: true },
    }),
    getActiveInvitationBroadcast(),
    getInvitationRecipients(true),
  ]);

  const list = recipients ?? [];
  const readyCount = list.filter((r) => r.status === "PENDING").length;
  const noPinCount = list.filter((r) => r.skipReason === "NO_PIN").length;
  const skippedCount = list.filter((r) => r.status === "SKIPPED" && r.skipReason !== "NO_PIN").length;

  let savedExcludeTagIds: string[] = [];
  if (cfg.invitationExcludeTagIds) {
    try {
      const parsed = JSON.parse(cfg.invitationExcludeTagIds);
      if (Array.isArray(parsed)) savedExcludeTagIds = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      savedExcludeTagIds = [];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("page.title")}</h1>
        <p className="text-sm text-zinc-400">{t("page.subtitle")}</p>
      </div>

      <InvitationsClient
        config={{
          invitationMessage: cfg.invitationMessage ?? "",
          invitationRsvpUseExternal: cfg.invitationRsvpUseExternal,
          invitationRsvpUrl: cfg.invitationRsvpUrl ?? "",
          invitationRsvpDeadline: cfg.invitationRsvpDeadline ?? "",
          hasArt: Boolean(cfg.invitationFilePath),
          artName: cfg.invitationFileName ?? null,
          artIsImage: (cfg.invitationFileMime ?? "").startsWith("image/"),
          excludeTagIds: savedExcludeTagIds,
          excludePadrinhos: cfg.invitationExcludePadrinhos,
        }}
        tags={tags}
        event={{
          coupleNames: cfg.coupleNames ?? "",
          eventDate: cfg.eventDate ? cfg.eventDate.toISOString() : null,
          daySchedule: cfg.daySchedule ?? null,
          configured: Boolean(cfg.eventDate && cfg.coupleNames),
        }}
        recipients={{ readyCount, noPinCount, skippedCount, list }}
        capabilities={{
          canManage: canManageUsers(userRole),
          whatsappConnected: getWhatsAppStatus().state === "CONNECTED",
          hasUserPhone: Boolean(user?.phone),
          hasUserEmail: Boolean(user?.email),
        }}
        activeBroadcast={active}
      />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { coerceLocale } from "@/i18n/config";
import { notify } from "./index";
import { wasNotifiedToday } from "./log";

const NOTIFY_ROLES = ["ADMIN", "GROOM", "BRIDE", "PLANNER"];

type RsvpNotifyInput = {
  refType: "Guest" | "GuestGroup";
  refId: string;
  guestName: string;
  rsvpStatus: string;
  plusOnes?: number;
  groupName?: string | null;
};

/**
 * Avisa gestores/noivos (ADMIN/GROOM/BRIDE/PLANNER ativos) quando um convidado responde
 * o RSVP. Best-effort: nunca lança. Deduplica por (refId) por dia para não floodar quando
 * o convidado reabre o link e responde de novo.
 */
export async function notifyRsvpResponse(input: RsvpNotifyInput): Promise<void> {
  try {
    if (await wasNotifiedToday("GUEST_RSVP", input.refType, input.refId)) return;

    const recipients = await prisma.user.findMany({
      where: { isActive: true, archivedAt: null, role: { in: NOTIFY_ROLES } },
      select: { id: true, name: true, email: true, locale: true },
    });

    await Promise.all(
      recipients.map((u) =>
        notify(
          { userId: u.id, email: u.email, locale: coerceLocale(u.locale) },
          {
            kind: "GUEST_RSVP",
            userName: u.name ?? u.email,
            guestName: input.guestName,
            rsvpStatus: input.rsvpStatus,
            plusOnes: input.plusOnes,
            groupName: input.groupName ?? null,
          },
          { refType: input.refType, refId: input.refId },
        ),
      ),
    );
  } catch (err) {
    console.error("[notifyRsvpResponse]", err);
  }
}

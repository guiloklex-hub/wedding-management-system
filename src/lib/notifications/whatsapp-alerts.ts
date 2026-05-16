import { prisma } from "@/lib/prisma";
import { notify } from "./index";
import { wasNotifiedToday } from "./log";
import type { WhatsAppDownReason } from "./templates";

const REF_TYPE = "WhatsAppSession";
const REF_ID = "singleton";

function settingsUrl(): string {
  const base = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3005";
  return `${base.replace(/\/$/, "")}/dashboard/settings`;
}

async function findAdmins() {
  return prisma.user.findMany({
    where: {
      role: "ADMIN",
      isActive: true,
      archivedAt: null,
    },
    select: { id: true, name: true, email: true },
  });
}

export type MaybeSendDownArgs = {
  reason: WhatsAppDownReason;
  attempts: number;
  lastError: string | null;
};

export async function maybeSendDownAlert(args: MaybeSendDownArgs): Promise<boolean> {
  try {
    const already = await wasNotifiedToday("SYSTEM_WHATSAPP_DOWN", REF_TYPE, REF_ID);
    if (already) return false;

    const admins = await findAdmins();
    if (admins.length === 0) return false;

    const url = settingsUrl();
    for (const admin of admins) {
      if (!admin.email) continue;
      await notify(
        { userId: admin.id, email: admin.email, phone: null },
        {
          kind: "SYSTEM_WHATSAPP_DOWN",
          userName: admin.name ?? admin.email,
          reason: args.reason,
          attempts: args.attempts,
          lastError: args.lastError,
          settingsUrl: url,
        },
        { refType: REF_TYPE, refId: REF_ID },
      );
    }
    return true;
  } catch (err) {
    console.error("[whatsapp-alerts] falha em maybeSendDownAlert:", err);
    return false;
  }
}

export async function sendRecoveredAlert(downtimeMinutes: number): Promise<boolean> {
  try {
    const hadDownAlert = await wasNotifiedToday("SYSTEM_WHATSAPP_DOWN", REF_TYPE, REF_ID);
    if (!hadDownAlert) return false;

    const alreadyRecovered = await wasNotifiedToday(
      "SYSTEM_WHATSAPP_RECOVERED",
      REF_TYPE,
      REF_ID,
    );
    if (alreadyRecovered) return false;

    const admins = await findAdmins();
    if (admins.length === 0) return false;

    const url = settingsUrl();
    for (const admin of admins) {
      if (!admin.email) continue;
      await notify(
        { userId: admin.id, email: admin.email, phone: null },
        {
          kind: "SYSTEM_WHATSAPP_RECOVERED",
          userName: admin.name ?? admin.email,
          settingsUrl: url,
          downtimeMinutes,
        },
        { refType: REF_TYPE, refId: REF_ID },
      );
    }
    return true;
  } catch (err) {
    console.error("[whatsapp-alerts] falha em sendRecoveredAlert:", err);
    return false;
  }
}

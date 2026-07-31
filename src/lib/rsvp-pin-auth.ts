"use server";

import { createHmac, createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { timingSafeEquals } from "@/lib/timing-safe";
import { getTranslations } from "next-intl/server";
import type { ActionResult } from "@/types";

const PIN_SECRET = process.env.NEXTAUTH_SECRET || "rsvp-pin-fallback-secret-key-32-chars!!";

function getCookieName(token: string): string {
  return `rsvp_pin_${createHash("sha256").update(token).digest("hex").slice(0, 16)}`;
}

export async function createPinTokenSignature(token: string, timestamp: number): Promise<string> {
  return createHmac("sha256", PIN_SECRET)
    .update(`${token}:${timestamp}`)
    .digest("hex");
}

export async function createPinAuthCookieValue(token: string): Promise<string> {
  const ts = Date.now();
  const sig = await createPinTokenSignature(token, ts);
  return `${ts}.${sig}`;
}

export async function verifyRsvpPinCookie(token: string): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieName = getCookieName(token);
  const cookie = cookieStore.get(cookieName);
  if (!cookie?.value) return false;

  const [tsStr, sig] = cookie.value.split(".");
  if (!tsStr || !sig) return false;

  const ts = parseInt(tsStr, 10);
  if (isNaN(ts)) return false;

  // Max age 15 minutes (900,000 ms)
  if (Date.now() - ts > 15 * 60 * 1000) return false;

  const expectedSig = await createPinTokenSignature(token, ts);
  return timingSafeEquals(sig, expectedSig);
}

const VerifyPinSchema = z.object({
  token: z.string().trim().min(1).max(64),
  pin: z.string().trim().min(1).max(32),
  type: z.enum(["individual", "group"]),
});

export async function verifyRsvpPinAction(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("rsvp.pin");
  const ip = getClientIp(await headers());
  const data = Object.fromEntries(formData.entries());
  const parsed = VerifyPinSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: t("invalid") };
  }

  const { token, pin, type } = parsed.data;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rl = rateLimit(`rsvp-pin:${ip}:${tokenHash}`, 5, 60_000);
  if (!rl.ok) {
    return { success: false, error: t("tooManyAttempts") };
  }

  let expectedPin: string | null = null;
  const now = new Date();

  if (type === "individual") {
    const guest = await prisma.guest.findFirst({
      where: {
        rsvpToken: token,
        deletedAt: null,
        OR: [{ rsvpTokenExpiresAt: null }, { rsvpTokenExpiresAt: { gt: now } }],
      },
      select: { rsvpPin: true },
    });
    expectedPin = guest?.rsvpPin ?? null;
  } else {
    const group = await prisma.guestGroup.findFirst({
      where: {
        rsvpToken: token,
        deletedAt: null,
        OR: [{ rsvpTokenExpiresAt: null }, { rsvpTokenExpiresAt: { gt: now } }],
      },
      select: { rsvpPin: true },
    });
    expectedPin = group?.rsvpPin ?? null;
  }

  if (!expectedPin || !timingSafeEquals(pin, expectedPin)) {
    return { success: false, error: t("invalid") };
  }

  const cookieStore = await cookies();
  const cookieName = getCookieName(token);
  const cookieValue = await createPinAuthCookieValue(token);
  const cookiePath = type === "individual" ? `/rsvp/${token}` : `/rsvp/group/${token}`;

  cookieStore.set(cookieName, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: cookiePath,
    maxAge: 15 * 60, // 15 minutes
  });

  return { success: true };
}

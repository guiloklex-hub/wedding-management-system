"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getSecuritySettings } from "@/lib/security-settings";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";
import { coerceLocale } from "@/i18n/config";
import type { ActionResult } from "@/types";

const RESET_TOKEN_TTL_MIN = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildResetUrl(token: string): string {
  const base =
    process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3005";
  return `${base.replace(/\/$/, "")}/reset-password/${token}`;
}

const RequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
});

export async function requestPasswordReset(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.passwordReset");
  const parsed = RequestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: t("invalidEmail") };
  }

  const { email } = parsed.data;
  let ip = "unknown";
  try {
    ip = getClientIp(await headers());
  } catch {
    // headers() pode falhar fora do request lifecycle; manter "unknown"
  }
  // Rate-limit por e-mail e por IP — protege contra enumeração e flood.
  if (!rateLimit(`forgot:email:${email}`, 1, 60_000).ok) {
    return { success: true };
  }
  if (!rateLimit(`forgot:ip:${ip}`, 5, 60_000).ok) {
    return { success: true };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.isActive && !user.archivedAt) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000);

    try {
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      await notify(
        { userId: user.id, email: user.email, phone: user.phone, locale: coerceLocale(user.locale) },
        {
          kind: "PASSWORD_RESET",
          userName: user.name ?? user.email,
          resetUrl: buildResetUrl(token),
          expiresInMinutes: RESET_TOKEN_TTL_MIN,
        },
        { refType: "User", refId: user.id },
      );

      await audit("User", user.id, "RESET_PASSWORD", { via: "LINK_REQUEST" });
    } catch (err) {
      console.error("[requestPasswordReset]", err);
    }
  } else {
    // Caminho "usuário inexistente" — simula custo de bcrypt + token gen para
    // que o atacante não consiga inferir existência via timing.
    try {
      const dummyHash = createHash("sha256").update(randomBytes(32)).digest("hex");
      await bcrypt.hash(dummyHash, 10);
    } catch {
      // best-effort
    }
  }

  return { success: true };
}

const ConsumeSchema = z.object({
  token: z.string().trim().min(32).max(128),
  newPassword: z.string().min(6).max(128),
  confirmPassword: z.string().min(6).max(128),
});

export async function consumePasswordReset(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("actions.passwordReset");
  const tc = await getTranslations("actions.common");
  const parsed = ConsumeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: tc("invalid") };
  }
  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return { success: false, error: t("passwordsDontMatch") };
  }

  const settings = await getSecuritySettings();
  if (parsed.data.newPassword.length < settings.passwordMinLength) {
    return {
      success: false,
      error: t("passwordTooShort", { min: settings.passwordMinLength }),
    };
  }

  const tokenHash = hashToken(parsed.data.token);
  const now = new Date();

  try {
    const updated = await prisma.passwordResetToken.updateMany({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (updated.count === 0) {
      return { success: false, error: t("invalidOrExpired") };
    }

    const tokenRow = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!tokenRow) {
      return { success: false, error: t("tokenNotFound") };
    }

    const user = await prisma.user.findUnique({ where: { id: tokenRow.userId } });
    if (!user || !user.isActive || user.archivedAt) {
      return { success: false, error: t("userNotFoundOrInactive") };
    }

    const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        mustChangePassword: false,
        passwordUpdatedAt: now,
      },
    });

    await audit("User", user.id, "RESET_PASSWORD", { via: "LINK_CONSUME" });

    return { success: true };
  } catch (err) {
    console.error("[consumePasswordReset]", err);
    return { success: false, error: t("errorResetting") };
  }
}

export async function validateResetToken(token: string): Promise<boolean> {
  if (!token || token.length < 32) return false;
  const tokenHash = hashToken(token);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!row) return false;
  if (row.usedAt) return false;
  if (row.expiresAt.getTime() < Date.now()) return false;
  return true;
}

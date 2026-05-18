import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { checkBackupCode, verifyTotpToken } from "@/lib/totp";
import { getSecuritySettings, role2FARequired } from "@/lib/security-settings";
import { getEventConfig, isOnboardingComplete } from "@/lib/event-config";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { coerceLocale } from "@/i18n/config";

export const TWO_FACTOR_REQUIRED = "2FA_REQUIRED";
export const TWO_FACTOR_SETUP_REQUIRED = "2FA_SETUP_REQUIRED";
export const TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS";

const DB_REVALIDATE_TTL_MS = 60_000;

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt(args) {
      const base = await authConfig.callbacks?.jwt?.(args);
      const token = (base ?? args.token) as typeof args.token & {
        lastDbCheckAt?: number;
        isActive?: boolean;
        archived?: boolean;
      };

      const id = typeof token.sub === "string" ? token.sub : undefined;
      if (!id) return token;

      const last = token.lastDbCheckAt ?? 0;
      const isFreshFromSignIn = !!args.user;
      if (!isFreshFromSignIn && Date.now() - last < DB_REVALIDATE_TTL_MS) {
        return token;
      }

      try {
        const db = await prisma.user.findUnique({
          where: { id },
          select: {
            isActive: true,
            archivedAt: true,
            mustChangePassword: true,
            role: true,
            locale: true,
          },
        });
        if (!db) {
          token.isActive = false;
          token.archived = true;
        } else {
          token.isActive = db.isActive;
          token.archived = !!db.archivedAt;
          token.mustChangePassword = db.mustChangePassword;
          token.role = db.role;
          if (db.locale) {
            (token as { locale?: string }).locale = db.locale;
          }
        }
        token.lastDbCheckAt = Date.now();
      } catch (err) {
        console.error("[auth/jwt] revalidate failed", err);
      }
      return token;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(1),
            totp: z.string().optional(),
          })
          .safeParse(credentials);
        if (!parsed.success) return null;

        let ip = "unknown";
        try {
          ip = getClientIp(await headers());
        } catch {
          // headers() pode falhar fora do request lifecycle; manter "unknown"
        }
        if (!rateLimit(`login:email:${parsed.data.email}`, 5, 60_000).ok) {
          throw new Error(TOO_MANY_ATTEMPTS);
        }
        if (!rateLimit(`login:ip:${ip}`, 30, 60_000).ok) {
          throw new Error(TOO_MANY_ATTEMPTS);
        }

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user) return null;

        const match = await bcrypt.compare(parsed.data.password, user.password);
        if (!match) return null;

        // Não distinguir "credencial inválida" de "conta desativada" — evita enumeração.
        if (!user.isActive || user.archivedAt) {
          return null;
        }

        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const token = (parsed.data.totp ?? "").trim();
          if (!token) throw new Error(TWO_FACTOR_REQUIRED);

          const isTotp = verifyTotpToken(token, user.twoFactorSecret);
          let isBackup = false;
          if (!isTotp) {
            const check = await checkBackupCode(token, user.twoFactorBackupCodes);
            isBackup = check.valid;
            if (isBackup) {
              await prisma.user.update({
                where: { id: user.id },
                data: { twoFactorBackupCodes: JSON.stringify(check.remaining) },
              });
            }
          }
          if (!isTotp && !isBackup) return null;
        } else {
          const settings = await getSecuritySettings();
          if (role2FARequired(user.role, settings)) {
            throw new Error(TWO_FACTOR_SETUP_REQUIRED);
          }
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const cfg = await getEventConfig();

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          onboardingCompleted: isOnboardingComplete(cfg),
          locale: coerceLocale(user.locale),
        };
      },
    }),
  ],
});

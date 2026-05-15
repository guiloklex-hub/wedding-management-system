import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { checkBackupCode, verifyTotpToken } from "@/lib/totp";

export const TWO_FACTOR_REQUIRED = "2FA_REQUIRED";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
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

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user) return null;

        const match = await bcrypt.compare(parsed.data.password, user.password);
        if (!match) return null;

        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const token = (parsed.data.totp ?? "").trim();
          if (!token) throw new Error(TWO_FACTOR_REQUIRED);

          const isTotp = verifyTotpToken(token, user.twoFactorSecret);
          let isBackup = false;
          if (!isTotp) {
            const check = checkBackupCode(token, user.twoFactorBackupCodes);
            isBackup = check.valid;
            if (isBackup) {
              await prisma.user.update({
                where: { id: user.id },
                data: { twoFactorBackupCodes: JSON.stringify(check.remaining) },
              });
            }
          }
          if (!isTotp && !isBackup) return null;
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});

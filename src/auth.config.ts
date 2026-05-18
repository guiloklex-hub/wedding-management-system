import type { NextAuthConfig } from "next-auth";
import { isLocale, type Locale } from "@/i18n/config";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const p = nextUrl.pathname;

      if (p.startsWith("/rsvp")) return true;
      if (p.startsWith("/forgot-password")) return true;
      if (p.startsWith("/reset-password")) return true;

      if (p.startsWith("/dashboard")) {
        if (!isLoggedIn) return false;

        const u = auth?.user as
          | {
              role?: string;
              mustChangePassword?: boolean;
              onboardingCompleted?: boolean;
              isActive?: boolean;
              archived?: boolean;
            }
          | undefined;

        // Sessão revogada: usuário arquivado/desativado deve ser deslogado.
        // O JWT é populado dinamicamente pelo callback `jwt` que consulta o DB.
        if (u && (u.isActive === false || u.archived === true)) {
          return Response.redirect(new URL("/login?revoked=1", nextUrl));
        }

        const mustChange = u?.mustChangePassword;
        const forcePath = "/dashboard/profile/change-password";
        if (mustChange && !p.startsWith(forcePath) && !p.startsWith("/api/auth")) {
          return Response.redirect(new URL(forcePath, nextUrl));
        }

        const onboardingPath = "/dashboard/onboarding";
        const needsOnboarding =
          u?.role === "ADMIN" && u?.onboardingCompleted === false && !mustChange;
        if (
          needsOnboarding &&
          !p.startsWith(onboardingPath) &&
          !p.startsWith(forcePath) &&
          !p.startsWith("/api/auth")
        ) {
          return Response.redirect(new URL(onboardingPath, nextUrl));
        }

        return true;
      }
      if (isLoggedIn) {
        if (p === "/login" || p === "/") {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as {
          role?: string;
          mustChangePassword?: boolean;
          onboardingCompleted?: boolean;
          locale?: string;
        };
        if (u.role !== undefined) token.role = u.role;
        if (u.mustChangePassword !== undefined) token.mustChangePassword = u.mustChangePassword;
        if (u.onboardingCompleted !== undefined)
          token.onboardingCompleted = u.onboardingCompleted;
        if (isLocale(u.locale)) token.locale = u.locale;
      }
      if (trigger === "update" && session) {
        const s = session as {
          mustChangePassword?: boolean;
          role?: string;
          onboardingCompleted?: boolean;
          locale?: string;
        };
        if (typeof s.mustChangePassword === "boolean") token.mustChangePassword = s.mustChangePassword;
        if (s.role) token.role = s.role;
        if (typeof s.onboardingCompleted === "boolean")
          token.onboardingCompleted = s.onboardingCompleted;
        if (isLocale(s.locale)) token.locale = s.locale;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const ext = session.user as {
          id?: string;
          role?: string;
          mustChangePassword?: boolean;
          onboardingCompleted?: boolean;
          isActive?: boolean;
          archived?: boolean;
          locale?: Locale;
        };
        if (typeof token.sub === "string") ext.id = token.sub;
        ext.role = token.role as string | undefined;
        ext.mustChangePassword = (token.mustChangePassword as boolean | undefined) ?? false;
        ext.onboardingCompleted = (token.onboardingCompleted as boolean | undefined) ?? true;
        ext.isActive = (token as { isActive?: boolean }).isActive ?? true;
        ext.archived = (token as { archived?: boolean }).archived ?? false;
        const tokenLocale = (token as { locale?: unknown }).locale;
        ext.locale = isLocale(tokenLocale) ? tokenLocale : undefined;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

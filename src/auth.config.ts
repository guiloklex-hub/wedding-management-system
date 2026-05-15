import type { NextAuthConfig } from "next-auth";

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
          | { role?: string; mustChangePassword?: boolean; onboardingCompleted?: boolean }
          | undefined;

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
        };
        if (u.role !== undefined) token.role = u.role;
        if (u.mustChangePassword !== undefined) token.mustChangePassword = u.mustChangePassword;
        if (u.onboardingCompleted !== undefined)
          token.onboardingCompleted = u.onboardingCompleted;
      }
      if (trigger === "update" && session) {
        const s = session as {
          mustChangePassword?: boolean;
          role?: string;
          onboardingCompleted?: boolean;
        };
        if (typeof s.mustChangePassword === "boolean") token.mustChangePassword = s.mustChangePassword;
        if (s.role) token.role = s.role;
        if (typeof s.onboardingCompleted === "boolean")
          token.onboardingCompleted = s.onboardingCompleted;
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
        };
        if (typeof token.sub === "string") ext.id = token.sub;
        ext.role = token.role as string | undefined;
        ext.mustChangePassword = (token.mustChangePassword as boolean | undefined) ?? false;
        ext.onboardingCompleted = (token.onboardingCompleted as boolean | undefined) ?? true;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

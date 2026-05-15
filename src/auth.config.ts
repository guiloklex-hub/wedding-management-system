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
      if (p.startsWith("/invite")) return true;

      if (p.startsWith("/dashboard")) {
        if (!isLoggedIn) return false;
        const mustChange = (auth?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword;
        const forcePath = "/dashboard/profile/change-password";
        if (mustChange && !p.startsWith(forcePath) && !p.startsWith("/api/auth")) {
          return Response.redirect(new URL(forcePath, nextUrl));
        }
        return true;
      }
      if (isLoggedIn) {
        if (p === "/login" || p === "/register" || p === "/") {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as { role?: string; mustChangePassword?: boolean };
        if (u.role !== undefined) token.role = u.role;
        if (u.mustChangePassword !== undefined) token.mustChangePassword = u.mustChangePassword;
      }
      if (trigger === "update" && session) {
        const s = session as { mustChangePassword?: boolean; role?: string };
        if (typeof s.mustChangePassword === "boolean") token.mustChangePassword = s.mustChangePassword;
        if (s.role) token.role = s.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const ext = session.user as {
          role?: string;
          mustChangePassword?: boolean;
        };
        ext.role = token.role as string | undefined;
        ext.mustChangePassword = (token.mustChangePassword as boolean | undefined) ?? false;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

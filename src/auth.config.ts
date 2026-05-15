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

      if (p.startsWith("/dashboard")) {
        return isLoggedIn;
      }
      if (isLoggedIn) {
        if (p === "/login" || p === "/register" || p === "/") {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user && "role" in user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string | undefined;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

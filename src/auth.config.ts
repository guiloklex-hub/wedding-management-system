import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        if (nextUrl.pathname === '/login' || nextUrl.pathname === '/register' || nextUrl.pathname === '/') {
           return Response.redirect(new URL('/dashboard', nextUrl));
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        // @ts-ignore
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        // @ts-ignore
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;

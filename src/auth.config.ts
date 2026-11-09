import type { NextAuthConfig } from "next-auth";

// Edge-safe config shared by middleware. The Credentials provider lives in auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // 12 hours
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role?: string }).role;
        token.totpEnabled = (user as { totpEnabled?: boolean }).totpEnabled;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as string;
      session.user.totpEnabled = Boolean(token.totpEnabled);
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/privacy") ||
        pathname === "/start" ||
        pathname.startsWith("/start/") ||
        pathname.startsWith("/intake/") ||
        pathname.startsWith("/feedback/") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/cron") ||
        pathname === "/api/health" ||
        pathname.startsWith("/api/webhooks");
      if (isPublic) return true;
      // Owner 2FA enforcement happens in the (app) layout, which reads the user fresh from the database.
      if (auth?.user) return true;
      // Behind the reverse proxy, request.nextUrl is the internal address (localhost:3000), so build the
      // login URL from the public host the proxy forwarded. Relative redirect target only (no open redirect).
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
      const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
      return Response.redirect(new URL("/login", `${proto}://${host}`), 307);
    },
  },
} satisfies NextAuthConfig;

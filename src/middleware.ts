import { NextResponse } from "next/server";

import NextAuth from "next-auth";

import { authConfig } from "@/server/auth/auth.config";

/**
 * Advisory edge middleware (feature 002-user-auth T031, research D8): the
 * coarse cookie/JWT presence check with NO Prisma/DB access — it can only
 * bounce obviously anonymous requests early. The AUTHORITATIVE guard is the
 * `(protected)` layout's `requireSession()` (DB row decides).
 *
 * Path note: with a `src/` directory structure Next requires this file in
 * `src/` (tasks.md says "repo root" — same semantics, required location).
 */

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set(
      "next",
      req.nextUrl.pathname + req.nextUrl.search,
    );
    return Response.redirect(signInUrl);
  }

  // Forward the current path so the authoritative layout guard can build
  // `next=<current path>` even when the middleware's coarse check passed but
  // the DB Session row is gone or expired.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    // Everything except: the health probe, Auth.js's own API routes, Next
    // internals, the public `(auth)` views, and static assets.
    "/((?!api/health|api/auth|_next/static|_next/image|favicon\\.ico|sign-in|register|.*\\.\\w+$).*)",
  ],
};

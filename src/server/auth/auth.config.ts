import type { AdapterUser } from "next-auth/adapters";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js base config (feature 002-user-auth, research D9).
 *
 * Importable by `middleware.ts` with NO Prisma import (Prisma is not
 * edge-compatible). The authoritative DB-backed session validation lives in
 * `session.ts` / the `(protected)` layout — this file only decides the
 * coarse cookie-presence behavior and shared strategy/pages/secret.
 */
declare module "next-auth" {
  interface Session {
    sessionId?: string;
  }
  interface User {
    sessionId?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    sessionId?: string;
  }
}

export const authConfig = {
  session: {
    strategy: "jwt",
    // 30 days; the sliding renewal happens server-side on every protected
    // interaction via the Session row (research D2), not here.
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [], // real providers registered in auth.ts (node runtime only)
} satisfies NextAuthConfig;

// AdapterUser referenced only to keep the type augmentation tree-shakeable
// if the adapter types are absent in some toolchain paths.
export type { AdapterUser };

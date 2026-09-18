import { cache } from "react";
import type { PrismaClient, Session } from "@/generated/prisma/client";

/**
 * Session CRUD service (feature 002-user-auth, research D2).
 *
 * The DB `Session` row is the sole trusted source of identity (constitution
 * I): the Auth.js JWT carries only the opaque `sessionId` claim, and every
 * protected interaction resolves that claim to a live row here.
 *
 * Sliding 30-day window (clarified FR-011): every successful validation is
 * ONE renewal write setting `expiresAt = now + 30 days`. No absolute cap —
 * a continuously active user is never forced to re-authenticate. Expired or
 * missing rows are treated as unauthenticated; stale rows are deleted
 * opportunistically.
 */

const SLIDING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function expiryFromNow(): Date {
  return new Date(Date.now() + SLIDING_WINDOW_MS);
}

// Test seam (D12): unit tests inject a mocked Prisma client instead of the
// real singleton; production code never calls setDbForTests.
let dbOverride: PrismaClient | null = null;

export function setDbForTests(client: PrismaClient): void {
  dbOverride = client;
}

async function getDb(): Promise<PrismaClient> {
  if (dbOverride) return dbOverride;
  const { db } = await import("@/server/db");
  return db;
}

export async function createSession(userId: string): Promise<Session> {
  const db = await getDb();
  return db.session.create({
    data: { userId, expiresAt: expiryFromNow() },
  });
}

export async function validateSession(
  sessionId: string,
): Promise<Session | null> {
  const db = await getDb();
  const row = await db.session.findUnique({ where: { id: sessionId } });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    // Expired: identical UX to sign-out — unauthenticated, stale row removed.
    await db.session.delete({ where: { id: sessionId } });
    return null;
  }
  // Sliding renewal: one write per protected interaction (research D2).
  return db.session.update({
    where: { id: sessionId },
    data: { expiresAt: expiryFromNow() },
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.session.delete({ where: { id: sessionId } });
}

export type ResolvedSession =
  | {
      status: "valid";
      session: Session & { user: { id: string; name: string; email: string } };
    }
  | { status: "expired"; session: null }
  | { status: "missing"; session: null };

/**
 * Status-aware sibling of `requireSession` (T032): distinguishes a session
 * that EXISTED but expired (`expiresAt <= now` → `status: "expired"`, stale
 * row removed) from a plain missing one — the `(protected)` layout uses it
 * to append `&reason=expired` for the graceful expiry experience (T036).
 * Identity derivation and sliding renewal are identical to `requireSession`.
 */
export const resolveSession = cache(async (): Promise<ResolvedSession> => {
  const { auth } = await import("./auth");
  const jwtSession = await auth();
  const sessionId = jwtSession?.sessionId;
  if (!sessionId) return { status: "missing", session: null };

  const db = await getDb();
  const row = await db.session.findUnique({ where: { id: sessionId } });
  if (!row) return { status: "missing", session: null };
  if (row.expiresAt.getTime() <= Date.now()) {
    // Expired: identical UX to sign-out — stale row removed opportunistically.
    await db.session.delete({ where: { id: sessionId } });
    return { status: "expired", session: null };
  }

  // Sliding renewal: ONE write via the shared service (research D2).
  const renewed = await validateSession(sessionId);
  if (!renewed || !jwtSession?.user)
    return { status: "missing", session: null };
  return {
    status: "valid",
    session: {
      ...renewed,
      user: {
        id: jwtSession.user.id ?? "",
        name: jwtSession.user.name ?? "",
        email: jwtSession.user.email ?? "",
      },
    },
  };
});

/**
 * Centralized server-side identity derivation (research D9): resolves the
 * JWT's opaque `sessionId` claim to a live Session row, renewing the sliding
 * window. Returns null when anything in the chain is missing/invalid.
 * `cache()` deduplicates per request so layouts, pages, and actions share
 * one validation (and one renewal write) per interaction.
 */
export const requireSession = cache(
  async (): Promise<
    (Session & { user: { id: string; name: string; email: string } }) | null
  > => {
    // Dynamic import breaks the auth.ts ↔ session.ts module cycle
    // (auth.ts registers createSession with the Credentials provider).
    const { auth } = await import("./auth");
    const jwtSession = await auth();
    const sessionId = jwtSession?.sessionId;
    if (!sessionId) return null;
    const row = await validateSession(sessionId);
    if (!row || !jwtSession?.user) return null;
    return {
      ...row,
      user: {
        id: jwtSession.user.id ?? "",
        name: jwtSession.user.name ?? "",
        email: jwtSession.user.email ?? "",
      },
    };
  },
);

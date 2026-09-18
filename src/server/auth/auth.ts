import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { authConfig } from "@/server/auth/auth.config";
import { normalizeEmail, signInSchema } from "@/validation/auth-schema";

/**
 * Full Auth.js v5 setup (feature 002-user-auth, research D1/D2/D6).
 *
 * - Credentials provider (constitution-mandated Auth.js; credentials force
 *   the JWT strategy). The JWT carries ONLY the opaque `sessionId` claim —
 *   no user data (D1).
 * - The DB `Session` row created here is the authoritative, server-revocable
 *   identity source; `session.ts` validates it on every protected
 *   interaction (D2).
 * - Timing equalization (D6): when the email is unknown, a DUMMY scrypt
 *   verification runs so unknown-email and wrong-password failures cost the
 *   same — account existence is not leakable through response timing.
 */

// Pre-computed REAL scrypt hash for the dummy verification path — parsing
// and the scrypt run cost exactly what a genuine verification costs (D6).
const DUMMY_HASH =
  "scrypt$16384$8$1$D1jWn0bbIKLgXvo3jbkxDA==$LJ46yhpB57ossf2yYiDDkcJxntQyX4GxX7nO52NakjwhWANbf6mnbt7OhQHgeGx+MOB5hF8mkTM3vm+fb5/5Xg==";

type AuthorizeInput = { email?: unknown; password?: unknown };

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const input = raw as AuthorizeInput;
        // (1) Validate — schema-level check only; the action layer owns the
        // user-facing validation_error contract.
        const parsed = signInSchema.safeParse({
          email: typeof input.email === "string" ? input.email : "",
          password: typeof input.password === "string" ? input.password : "",
        });
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) {
          // D6: dummy verification — same cost as the real path.
          await verifyPassword(password, DUMMY_HASH);
          return null;
        }
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        // D2: first Session row for this sign-in; its opaque id becomes the
        // JWT claim validated on every protected interaction.
        const session = await createSession(user.id);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          sessionId: session.id,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sessionId = user.sessionId;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sessionId) {
        session.sessionId = token.sessionId;
      }
      return session;
    },
  },
});

// normalizeEmail is re-exported for the action layer's duplicate check so
// registration and sign-in share one normalization implementation.
export { normalizeEmail };

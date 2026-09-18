# Research: User Authentication & Authorization (F002)

**Feature**: `002-user-auth` | **Date**: 2026-09-16 | **Status**: Complete — no NEEDS CLARIFICATION items remain

All clarifications from the spec (session window, return destination, email normalization, input limits) are pinned inputs, not research questions. The stack is fixed by the constitution; research below resolves the open *implementation design* decisions. F001's research decisions (npm D1, Node 22 D2, tooling D5, Vitest/RTL/Playwright D6–D7) are inherited and not re-litigated.

## D1: Session architecture — Auth.js Credentials + JWT cookie carrying an opaque `sessionId`, validated against a DB `Session` row

- **Decision**: Use Auth.js v5 (`next-auth@beta`) with a Credentials provider. The JWT session cookie contains no user data except an opaque `sessionId` claim; the `jwt` callback stores it at sign-in, and a server-side validation wrapper checks the JWT *and* the referenced `Session` row (existence + `expiresAt > now`) on every protected interaction, extending `expiresAt` (sliding 30-day window, clarified FR-011).
- **Rationale**: Auth.js is constitution-mandated, and Credentials auth forces JWT strategy. Wrapping validation with a DB check restores everything JWT alone cannot do: server-side revocation (multi-tab sign-out edge case), sliding expiry, and the "deleted session rejects instantly" edge case — while keeping Auth.js as the credential/ticket layer per the mandated stack.
- **Alternatives considered**: (a) Pure JWT sessions — rejected: cannot revoke server-side; a "signed-out" tab would keep working, violating FR-010 and the revocation edge case. (b) Auth.js database sessions — rejected: the database strategy is unsupported with the Credentials provider. (c) Hand-rolled signed session cookies — rejected: violates the constitution's approved-stack constraint and reinvents tested security machinery.

## D2: Session model & sliding-window mechanics

- **Decision**: `Session` rows: `id` (cuid, primary key — the opaque claim value), `userId`, `expiresAt`, `createdAt`. On every protected interaction the validation wrapper atomically sets `expiresAt = now + 30 days` when the session is still valid; a row with `expiresAt <= now` (or missing) is treated as unauthenticated and deleted opportunistically. Absolute cap: none — pure sliding per the clarified FR-011.
- **Rationale**: Matches the clarified session semantics exactly; a single timestamped row makes expiry, extension, and revocation (delete row → the JWT claim no longer resolves) each a one-line operation. Idle-timeout behavior falls out naturally (30 days of inactivity ends the session).
- **Alternatives considered**: (a) `lastActiveAt` + computed expiry — rejected: two fields where one suffices; risks divergence. (b) Per-request write on every interaction — adopted for correctness; the extra indexed row update per protected page load is negligible at this scale (Prisma `update` by primary key).

## D3: Password hashing — Node built-in `crypto.scrypt`

- **Decision**: `src/server/auth/password.ts` implements `hashPassword`/`verifyPassword` with `node:crypto`'s `scrypt` (N=16384, r=8, p=1 — OWASP-aligned params; 64-byte key; 16-byte random salt). Storage format: `scrypt$N$r$p$<salt-b64>$<hash-b64>` (self-describing, enables future parameter upgrades). Verification uses `crypto.timingSafeEqual` after a length check.
- **Rationale**: Satisfies "passwords never stored in plaintext" (constitution I, FR-002) with **zero new runtime dependencies** — honoring the constitution's "no unnecessary libraries" better than bcrypt/argon2. `crypto.scrypt` is the modern Node-native KDF (memory-hard, recommended by OWASP), and the clarified 8–72-character password limit keeps input bounded.
- **Alternatives considered**: (a) bcryptjs — rejected: adds a runtime dependency for capability Node already ships. (b) argon2 (native) — rejected: native build friction on Windows dev environments for no requirement-driven benefit. (c) `crypto.scryptSync` — rejected: blocks the event loop; async `scrypt` is equally simple.

## D4: Email normalization & validation schemas

- **Decision**: `src/validation/auth-schema.ts` exports `registerSchema`, `signInSchema`, and `normalizeEmail` (`.trim().toLowerCase()` per clarified FR-001/FR-004). Email: trimmed lowercase, RFC-lite pattern, max 254 chars (clarified). Password: 8–72 characters (clarified), no complexity rules (spec decision). Name: trimmed, 1–80 chars (spec Assumptions pin the documented maximum at 80; the spec's long-input edge case repeats it). Zod `.transform()` normalizes at parse time so client and server see identical values.
- **Rationale**: Single source of truth (constitution II); normalization at schema level means no caller can forget it, and round-tripping a stored email against a re-typed one always matches.
- **Alternatives considered**: (a) Normalizing in the server action only — rejected: client-side duplicate checks and error messages would see un-normalized input; violates the shared-schema principle. (b) Strict RFC 5322 validation — rejected: over-strict patterns reject deliverable real-world addresses; deliverability is out of scope (no verification email per spec Assumptions).

## D5: Registration flow (server action `register`)

- **Decision**: Five-step contract (constitution): (1) Zod-validate; (2) no auth required (anonymous); (3) normalize email → `findUnique` — if taken, return a field error on email (account-existence disclosure at registration is inherent to the feature's UX; FR-005's indistinguishability requirement applies to *sign-in* only); (4) `hashPassword` + create `User`; (5) create the first `Session` row and sign the user in server-side, returning a success result the form turns into a redirect to the protected area (US1: signed in immediately, no separate sign-in step).
- **Rationale**: Keeps the action thin (business logic lives in `password.ts`/`session.ts`), returns predictable result objects — never raw Prisma entities, so `passwordHash` cannot leak by construction (constitution I).
- **Alternatives considered**: (a) Separate register + auto sign-in via a second request — rejected: extra round-trip and a race window. (b) Returning the created `User` object — rejected: constitution forbids unnecessary raw DB objects to the client; the action returns `{ ok: true }` or field errors only.

## D6: Sign-in flow (server action `signIn`) & timing equalization

- **Decision**: Five-step contract: (1) Zod-validate + normalize; (2–3) N/A (anonymous by definition); (4) fetch user by normalized email — **if unknown, run a dummy scrypt verification against a constant fake hash, then return the generic failure**; if known, verify the password with `verifyPassword`; (5) on success create `Session`, sign in, and honor the `returnTo` destination as-is (clarified FR-008); on failure return the single generic message ("Invalid email or password") for both branches.
- **Rationale**: FR-005/FR-010 demand unknown-email and wrong-password failures be indistinguishable — wording alone is insufficient because response *timing* leaks account existence; the dummy verification equalizes cost. Honoring `returnTo` as-is (including external URLs) is the clarified, deliberately accepted open-redirect posture — the action implements it literally and the risk is recorded in the spec's Edge Cases.
- **Alternatives considered**: (a) Early return on unknown email — rejected: timing side channel. (b) Validating/sanitizing `returnTo` — rejected *by clarification*: the spec answer explicitly accepts external-URL returns; changing this is a one-line FR-008 amendment if revisited.

## D7: Sign-out flow (server action `signOut`)

- **Decision**: Five-step contract: (1) no body to validate; (2) resolve the current session (if any); (3) N/A (signing out your own session is always authorized); (4) delete the `Session` row; (5) clear the Auth.js cookie and redirect to the sign-in view. Every tab loses access on its next protected interaction because the JWT claim no longer resolves to a row.
- **Rationale**: One delete operation implements the multi-tab sign-out edge case exactly; no per-tab bookkeeping needed.
- **Alternatives considered**: (a) JWT denylist/`jti` revocation — rejected: stateful cookie bookkeeping where row deletion already exists. (b) Client-side cookie clearing only — rejected: violates server-authoritative security; the server must reject the claim regardless of what the browser sends.

## D8: Route protection — middleware for speed, protected layout for authority

- **Decision**: `middleware.ts` performs a coarse, fast check (session cookie / JWT presence, via edge-safe `auth.config.ts`) and redirects unauthenticated visitors to `src/app/(auth)/sign-in` with `?next=<original-path>` for UX speed — **but the authoritative gate is `src/app/(protected)/layout.tsx`**, a Server Component that calls the full server-side session validation (JWT + DB row + sliding extension) and redirects when invalid. The `(auth)` group has a reverse-guard layout bouncing already-signed-in users to the protected area (FR-009).
- **Rationale**: Next.js middleware runs on the edge runtime where Prisma is unavailable — so the middleware check can only be advisory. Placing the true check in the protected layout keeps constitution I intact while still giving fast redirects for the common case. This split is the standard Auth.js + App Router pattern.
- **Alternatives considered**: (a) Middleware-only protection — rejected: cannot validate the DB session at the edge; would violate server-authoritative identity. (b) Per-page guards — rejected: duplication; one layout guard covers every current and future protected page. (c) DB validation inside middleware via a self-fetch to a route handler — rejected: added complexity and self-request latency with no benefit over the layout guard.

## D9: Centralized identity derivation (`requireSession` wrapper)

- **Decision**: `src/server/auth/session.ts` exposes `requireSession()`: resolves the Auth.js JWT → extracts `sessionId` → loads the row → if valid, extends `expiresAt` (sliding window) and returns `{ user, session }`; if invalid/expired/revoked, deletes the stale row (if present) and returns `null` (the layout redirects; actions treat as unauthenticated). All Auth.js usage outside the Credentials `authorize` callback flows through this helper so no caller can skip the DB check. Per-request caching (React `cache()`) shares one lookup + one extension write across the request's server components.
- **Rationale**: Centralizes the constitution-I invariant ("authenticated user derived from the server-side session") in exactly one function — every protected surface calls it or nothing protected happens.
- **Alternatives considered**: (a) Scattered inline checks in each layout/action — rejected: one missed call is a security hole; the wrapper makes the safe path the easy path. (b) Passing identity from the client as props/state — rejected: constitution I forbids trusting browser-supplied identity.

## D10: Form components & error UX

- **Decision**: `src/features/auth/RegisterForm.tsx` and `SignInForm.tsx` are client components using `useActionState` with the server actions. Validation errors render inline next to the relevant field (FR-013); auth failures render one generic form-level message; submit shows a pending state (disabled button + spinner text); all fields labeled, keyboard-operable, focus-visible (constitution V, FR-013). Buttons and inputs reuse the F001 `src/components/ui/` primitives.
- **Rationale**: Matches the F001 shell's shadcn conventions and constitution V's accessibility requirements with the least client JS (two small client components; everything else stays a Server Component).
- **Alternatives considered**: (a) Server-rendered forms without client interactivity — rejected: loses the per-field inline error UX FR-013 requires. (b) Third-party form library (react-hook-form) — rejected: unnecessary dependency; two forms don't justify it ("no unnecessary libraries").

## D11: Prisma data model & migration

- **Decision**: `prisma/schema.prisma` gains the first business models: `User { id, name, email @unique, passwordHash, createdAt, updatedAt, sessions Session[] }` and `Session { id (cuid, PK — the opaque claim), userId, expiresAt, createdAt, user relation, @@index([userId]), @@index([expiresAt]) }`, with `onDelete: Cascade` from User → Session. One migration creates both tables; email uniqueness is enforced by a DB constraint (constitution II: "user email unique").
- **Rationale**: Matches the constitution's User contract exactly (id, name, unique email, passwordHash, createdAt, updatedAt) plus the clarified Session entity. The `expiresAt` index supports opportunistic stale-session cleanup; the `userId` index supports per-user session queries and cascade integrity.
- **Alternatives considered**: (a) UUID vs cuid ids — cuid: shorter, sortable, and unguessable enough for an opaque session claim. (b) Storing token *hashes* in the DB instead of raw opaque ids — considered; the id is already opaque and never logged, so hashing adds no practical security here and is documented as possible future hardening. (c) Storing `email` case-preserved with a case-insensitive index — rejected: the clarification mandates normalization *at input*, making storage canonical by construction.

## D12: Test strategy hooks

- **Decision**: Unit tests exercise the shared schemas, `password.ts` (hash/verify roundtrip, wrong-password rejection, malformed-hash rejection, format determinism), and `session.ts` logic. Component tests render both forms (inline field errors, generic failure, pending state, a11y). E2E (`tests/e2e/auth.spec.ts`) covers: register → auto sign-in; sign-out; multi-tab sign-out (two pages); back-button after sign-out; forged-identity attempts (replaying another user's identifiers must fail); session expiry — simulated by rewinding `expiresAt` in the dev database via the test harness, then verifying the next protected interaction redirects to sign-in. `AUTH_SECRET` in tests is a fixed development value; E2E runs against F001's disposable dev database per the established harness conventions.
- **Rationale**: Maps 1:1 to the spec's edge cases; the expiry test *simulates* the 30-day window by manipulating `expiresAt` (waiting is not an option), and the DB-backed design (D2) makes that simulation a one-line UPDATE.
- **Alternatives considered**: (a) Mocking time in E2E — rejected: couples tests to Auth.js internals; the DB rewind tests the real validation path. (b) Unit tests of `session.ts` with a mocked Prisma — adopted (speed); E2E covers the real DB path.

## D13: Environment contract extension

- **Decision**: `AUTH_SECRET` (required, minimum length 32) is added to `src/lib/env.ts`'s fail-fast Zod schema and documented in `.env.example`. On startup without it the app exits with the single actionable F001-style message — never a stack trace.
- **Rationale**: Auth.js requires a secret for cookie signing; extending the existing fail-fast mechanism keeps the F001 DX bar (FR-012 pattern) and prevents silently-weak defaults in any environment.
- **Alternatives considered**: (a) A development fallback secret — rejected: masks misconfiguration; fails the "clear, actionable" env contract. (b) Keeping the secret only in the Auth.js config — rejected: one environment schema per the F001-established contract.

## Consolidated resolution table

| Original unknown / design question | Resolved by |
|---|---|
| Session revocation + sliding-window mechanics | D1, D2 |
| Password hashing without violating "no unnecessary libraries" | D3 |
| Email normalization application point | D4 |
| Registration auto-sign-in mechanics | D5 |
| Sign-in indistinguishability (incl. timing) | D6 |
| Return-destination honoring (clarified FR-008) | D6 |
| Multi-tab sign-out | D7 |
| Edge/DB split for route protection | D8 |
| Centralized server-side identity derivation | D9 |
| Form/error/a11y approach | D10 |
| First business Prisma models | D11 |
| Testing the 30-day window & security scenarios | D12 |
| `AUTH_SECRET` environment contract | D13 |
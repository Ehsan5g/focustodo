# Implementation Plan: User Authentication & Authorization (F002)

**Branch**: `002-user-auth` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-user-auth/spec.md`

## Summary

Add account registration, sign-in/sign-out, protected routes, and trustworthy sessions on top of the F001 foundation. Auth.js (constitution-mandated) issues the session credential, while authoritative identity stays server-side: a database-backed `Session` table makes sessions revocable (multi-tab sign-out) and sliding (30-day window extended on each protected interaction), per the spec's clarifications. Registration and sign-in run as server actions following the constitution's five-step contract, validated by shared Zod schemas — emails normalized to trimmed lowercase, passwords 8–72 characters hashed with Node's built-in `crypto.scrypt` (zero new runtime dependencies). Signed-out visitors are redirected to sign-in with their destination preserved and honored as-is after sign-in (clarified FR-008); signed-in users are bounced from the sign-in/registration views back to the protected area. Vitest + React Testing Library + Playwright cover unit, component, and E2E layers — including the forged-identity rejection and multi-tab sign-out security scenarios. All open design decisions (session strategy, hashing, middleware split, test hooks) are resolved in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict mode) on Node.js 22 LTS (`.nvmrc`); npm as package manager (F001 research.md D1–D2)

**Primary Dependencies**: Next.js 16 (App Router), Auth.js v5 (`next-auth`, constitution-mandated) with Credentials provider, Zod, Prisma ORM, Tailwind CSS + shadcn/ui conventions; password hashing via Node built-in `crypto.scrypt` — zero new runtime dependencies (research.md D1–D5)

**Storage**: PostgreSQL 16 in the F001 disposable local Docker container; Prisma migrations introduce the first business models: `User` + `Session` (research.md D11)

**Testing**: Vitest (unit) + React Testing Library (component) + Playwright E2E on Chromium — auth journeys, redirect/return behavior, forged-identity rejection, multi-tab sign-out, session-expiry simulation (research.md D12)

**Target Platform**: Local development (macOS/Windows/Linux); current stable Chrome/Firefox/Safari; responsive 320–1280 px

**Project Type**: Single full-stack Next.js application (extends the F001 skeleton in place)

**Performance Goals**: Registration and sign-in complete in under 2 seconds under normal local conditions (SC-001/SC-002); F001 quality-gate budgets inherited unchanged (type check <1 min, suites <1 min, E2E <5 min)

**Constraints**: Server-side session is the only source of identity (constitution I, FR-010); sliding 30-day session window extended on each protected interaction (FR-011); no plaintext passwords in storage, logs, or responses (FR-002); every mutation follows the five-step server-action contract; no runtime libraries beyond the approved stack; return destination honored as-is including external URLs (clarified FR-008); English UI, friendly non-technical errors

**Scale/Scope**: 3 public views (sign-in, registration + reverse-guarded auth group) + protected shell; 2 entities (`User`, `Session`); 4 user stories, 15 FRs, 9 edge cases, 8 success criteria

- **I. Server-Authoritative Security (NON-NEGOTIABLE)**: PASS — identity for every protected operation is derived from a server-validated `Session` row (research.md D2); browser-supplied user identifiers are never trusted (FR-010); Zod re-validates every action input on the server even though the client also validates (FR-003); passwords exist only as scrypt hashes and are never returned to the client (FR-002; data-model invariants); sign-in failures are timing-equalized and generic (FR-005); the middleware/protected-layout split enforces redirects without exposing protected content (FR-007).
- **II. Type Safety and Strict Validation**: PASS — shared Zod schemas in `src/validation/auth-schema.ts` are the single source of truth for registration and sign-in inputs, consumed by client forms and server actions alike; TypeScript strict with the F001 lint baseline (no `any`, no unnecessary assertions).
- **III. Modular Architecture and Simplicity**: PASS — auth code follows the F001 skeleton's mandated separation: `src/server/auth/` (Auth.js config, password service, session service), `src/server/actions/` (thin five-step server actions), `src/validation/` (schemas), `src/features/auth/` (form components), route groups `(auth)`/`(protected)`; Server Components by default, client components only for the two forms. Two mechanisms add deliberate complexity and are pre-justified in Complexity Tracking: the DB-backed revocable session layer on top of Auth.js Credentials/JWT, and timing-equalized sign-in verification.
- **IV. Test-First Quality Gates (NON-NEGOTIABLE)**: PASS — planned coverage: unit (schemas, password hash/verify roundtrip incl. wrong password and malformed-hash rejection, session create/validate/extend/delete), component (register/sign-in forms: inline field errors, generic failure, loading state, keyboard operability), E2E (registration, sign-in, sign-out, redirect + return, back-button, forged-identity rejection, multi-tab sign-out, session expiry). Constitution IV's cross-user security scenario is structurally covered by the forged-identity and multi-tab tests; tests are written and observed failing before the code that satisfies them.
- **V. Production UX, Accessibility, and Performance**: PASS — semantic, fully keyboard-operable forms with visible focus, labeled fields, and inline errors near the relevant field (FR-013); visible loading/success/failure states (FR-013); friendly non-technical messages that never expose server internals (FR-005, edge cases); interface reflects signed-out/signed-in state everywhere (FR-012); the F001 shell keeps its responsive and theming behavior inside the protected group.
- **Technology and Security Constraints**: PASS — Auth.js, Zod, server actions, Next.js 16, Prisma, and PostgreSQL are all approved-stack elements; password hashing uses Node's built-in `crypto.scrypt`, so "no unnecessary libraries" is honored with zero new runtime dependencies (research.md D3); `AUTH_SECRET` joins the fail-fast environment contract (`src/lib/env.ts`, `.env.example` — D13); no credentials or tokens are ever logged.

**Pre-Phase-0 Verdict**: No unjustified violations — Phase 0 research may proceed.

**Post-Phase-1 Re-check**: PASS — after [research.md](research.md) (D1–D13), [data-model.md](data-model.md), [contracts/](contracts/), and [quickstart.md](quickstart.md): no new violations surfaced. Principle I holds by construction (identity only via `requireSession()`; `passwordHash` excluded from every result shape in contracts/server-actions.md; revocation via row deletion). Principle II holds (single shared schema file; strict TS untouched). Principle III's two justified complexities are exactly the two Complexity Tracking rows above — both stand. Principle IV's coverage list is materialized in D12 and quickstart.md's gate commands. Principle V's UX bar is contractual (inline errors, generic messages, pending states). Technology constraints: zero new runtime dependencies confirmed (scrypt is Node built-in; Auth.js/Zod/Prisma already approved).

## Project Structure

### Documentation (this feature)

```text
specs/002-user-auth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

F002 extends the F001 skeleton in place (no structural change); new and modified paths only:

```text
prisma/schema.prisma                   # ADD: User + Session models (first business models)
prisma/migrations/                     # ADD: migration creating users/sessions tables
.env.example                           # ADD: AUTH_SECRET documented (D13)
src/lib/env.ts                         # EXTEND: AUTH_SECRET joins the fail-fast validation (D13)
src/validation/auth-schema.ts          # ADD: shared register/sign-in Zod schemas + normalizeEmail (D4)
src/server/auth/auth.config.ts         # ADD: edge-safe Auth.js base config for middleware (D9)
src/server/auth/auth.ts                # ADD: full Auth.js config + handler exports (JWT with opaque sessionId claim, callbacks) (D2)
src/server/auth/password.ts            # ADD: scrypt hash/verify service (node:crypto, timing-safe compare) (D3)
src/server/auth/session.ts             # ADD: Session CRUD service (create/validate/extend/delete) (D2)
src/server/actions/auth-actions.ts     # ADD: register / signIn / signOut server actions (five-step contract) (D5–D7)
src/app/(auth)/sign-in/page.tsx        # ADD: sign-in view (public)
src/app/(auth)/register/page.tsx       # ADD: registration view (public)
src/app/(auth)/layout.tsx              # ADD: reverse guard — signed-in users are bounced to the protected area (FR-009)
src/app/(protected)/layout.tsx         # ADD: authoritative server-side session guard for the protected area (D8)
src/app/(protected)/page.tsx           # MOVE: F001 shell becomes the protected area (FR-012, spec Assumptions)
middleware.ts                          # ADD: coarse edge check (cookie/JWT presence) + destination capture for fast redirects (D9)
src/features/auth/                     # ADD: RegisterForm + SignInForm client components (D10)
tests/unit/ tests/component/           # ADD: schema, password, and session service tests; form component tests (D12)
tests/e2e/auth.spec.ts                 # ADD: full auth E2E journeys incl. security scenarios (D12)
```

**Structure Decision**: Single full-stack Next.js project, extending F001's tree unchanged in shape (npm, `src/` + `tests/` at root, Prisma confined to `src/server/`, shared schemas in `src/validation/`). Auth adds one server module group (`src/server/auth/`), one thin actions module, two route groups (`(auth)`, `(protected)`), and the auth feature components; the F001 placeholder shell becomes the protected area's content per the spec's Assumptions. `src/app/api/health/route.ts` stays public (infrastructure probe, no user data) and is excluded from protection.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| DB-backed revocable `Session` table layered on top of Auth.js Credentials/JWT sessions (research.md D2) | Auth.js's Credentials provider is bound to JWT sessions, but constitution I + FR-010 + the multi-tab sign-out edge case require server-side revocation and a sliding 30-day window | Pure JWT sessions (Auth.js default) cannot be revoked server-side — a signed-out tab would keep working; Auth.js's database-session strategy does not support the Credentials provider; hand-rolled session crypto violates the mandated Auth.js usage |
| Timing-equalized sign-in (dummy scrypt verification when the email is unknown) | FR-005/FR-010 require unknown-email and wrong-password failures to be indistinguishable in behavior, not just wording | Returning immediately on unknown email leaks account existence through response timing; the equalization adds one constant-cost verification, not an abstraction |

(Both entries above are constitution-compliant after justification — Principle III's "added complexity MUST be justified" is satisfied here rather than leaving a violation.)

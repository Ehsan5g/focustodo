---
description: "Task list for F002 User Authentication & Authorization"
---

# Tasks: User Authentication & Authorization (F002)

**Input**: Design documents from `/specs/002-user-auth/`

**Prerequisites**: plan.md âœ…, spec.md âœ…, research.md âœ… (13 decisions D1â€“D13), data-model.md âœ…, contracts/ âœ… (server-actions, routes-and-guards), quickstart.md âœ… (S1â€“S10)

**Tests**: Included â€” FR-015 mandates automated E2E covering registration, sign-in, sign-out, redirects, and forged-identity rejection; constitution IV requires unit/component/E2E gates; D12 pins the strategy (expiry simulated by a DB `expiresAt` rewind, never time-mocking; fixed dev `AUTH_SECRET`).

**Organization**: Grouped by user story â€” US1 Account Registration (P1), US2 Sign In and Sign Out (P1), US3 Protected Routes and Redirects (P1), US4 Trustworthy Sessions and Auth-State-Aware Interface (P2). Action shapes per `contracts/server-actions.md`; route/guard/destination semantics per `contracts/routes-and-guards.md`; entities per `data-model.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1â€“US4)

## Path Conventions

Single full-stack Next.js project extending F001 in place (plan.md): `src/` + `tests/` at repository root; Prisma confined to `src/server/`; shared Zod schemas in `src/validation/`; `src/app/api/health/route.ts` stays public (infrastructure probe, excluded from protection).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch, the one mandated dependency, the first business data model, and the extended env contract.

- [x] T001 Confirm the F001 foundation is complete and all its quality gates are green (`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run test:e2e`), then create and switch to branch `002-user-auth` (if no git repo exists yet, first execute F001 T001 â€” `.gitignore` before any commit)
- [x] T002 [P] Install Auth.js v5: `npm install next-auth@beta` â€” the ONLY new runtime dependency of this feature (constitution-mandated mechanism; password hashing uses Node built-in `crypto.scrypt`, research D3)
- [x] T003 [P] Extend `prisma/schema.prisma` with the first business models exactly per data-model.md: `User { id String @id @default(cuid()), name String, email String @unique, passwordHash String, createdAt DateTime @default(now()), updatedAt DateTime @updatedAt, sessions Session[] }` and `Session { id String @id @default(cuid()), userId String, expiresAt DateTime, createdAt DateTime @default(now()), user User @relation(fields: [userId], references: [id], onDelete: Cascade), @@index([userId]), @@index([expiresAt]) }` â€” `email @unique` enforces constitution II; `passwordHash` is never selected into client payloads (research D11)
- [x] T004 Create and apply the migration `npx prisma migrate dev --name user_auth`; verify the `users` and `sessions` tables plus the email-unique, `sessions.userId`, and `sessions.expiresAt` indexes exist in the dev database (D11; depends on T003)
- [x] T005 [P] Extend the fail-fast environment contract: add `AUTH_SECRET` (required, minimum length 32) to the Zod schema in `src/lib/env.ts` â€” missing/weak value exits startup with ONE actionable message, never a stack trace â€” and document `AUTH_SECRET` in `.env.example` (D13; contracts/routes-and-guards.md "Environment contract")
- [x] T006 Add a real `AUTH_SECRET` (â‰¥32 chars) to the local `.env` used by dev and E2E and verify `npm run dev` still boots and `/api/health` still returns 200 (D13; depends on T005)

**Checkpoint**: Branch `002-user-auth`; Auth.js installed; `users`/`sessions` tables migrated; `AUTH_SECRET` fail-fast active.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation, hashing, session service, and the Auth.js core every user story builds on.

**âš ï¸ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 [P] Write the failing unit tests for the shared schemas in `tests/unit/auth-schema.test.ts` (D4, D12): name 1â€“80 characters, trimmed (spec Assumptions â€” supersedes any "1â€“100" wording elsewhere in the design docs); email â‰¤254 characters + RFC-lite pattern + `normalizeEmail` (trimmed and lowercased â€” `John@X.com` â‰¡ `john@x.com`); password 8â€“72 inclusive (7 â†’ reject, 8 and 72 â†’ accept, 73 â†’ reject); no complexity rules on passwords
- [x] T008 Create `src/validation/auth-schema.ts` making T007 pass: `registerSchema` (name, email, password) + `signInSchema` (email, password) + `normalizeEmail` helper â€” the single Zod source of truth shared by client and server (constitution II; D4)
- [x] T009 [P] Write the failing unit tests for the password service in `tests/unit/password.test.ts` (D3, D12): hashâ†’verify roundtrip; wrong password rejected; malformed/garbage stored hash rejected without throwing; deterministic `scrypt$N$r$p$<salt-b64>$<hash-b64>` format; two hashes of the same password differ (unique salts)
- [x] T010 Create `src/server/auth/password.ts` making T009 pass: `hashPassword`/`verifyPassword` with `node:crypto` scrypt â€” N=16384, r=8, p=1 (OWASP-aligned), 64-byte key, 16-byte random salt; verification via `crypto.timingSafeEqual` after a length check (D3)
- [x] T011 [P] Create `src/server/auth/auth.config.ts` â€” the edge-safe Auth.js base config importable by middleware with NO Prisma import: session strategy `jwt` with 30-day `maxAge` (sliding enforced server-side per D2), custom pages (`signIn: "/sign-in"`), secret from `src/lib/env.ts` (D9)
- [x] T012 [P] Write the failing unit tests for the session service with a mocked Prisma client in `tests/unit/session.test.ts` (D2, D12): valid session (`expiresAt > now`) â†’ returned AND `expiresAt` extended to `now + 30 days`; expired (`expiresAt <= now`) â†’ `null` returned AND row deleted; missing row â†’ `null`
- [x] T013 Create `src/server/auth/session.ts` making T012 pass: `createSession(userId)`; `validateSession(sessionId)` â€” row exists with `expiresAt > now` â†’ ONE renewal write setting `expiresAt = now + 30 days`, expired/missing â†’ opportunistic delete + `null` (no absolute cap â€” pure sliding per clarified FR-011); `deleteSession(sessionId)`; plus `requireSession()` wrapped in React `cache()` deriving identity from the JWT's opaque `sessionId` claim â†’ DB row (D2, D9)
- [x] T014 Create `src/server/auth/auth.ts` â€” full Auth.js v5 setup (D1, D2, D6): Credentials provider whose `authorize()` looks up the user by normalized email, runs a DUMMY scrypt verification when the email is unknown (timing equalization), verifies with `verifyPassword`, creates a `Session` row via the session service, and returns `{ id, sessionId }`; the `jwt` callback stores ONLY the opaque `sessionId` claim; export `{ handlers, auth, signIn, signOut }`
- [x] T015 Run the quality gates (`npm run typecheck && npm run lint && npm run format:check && npm run test`) and commit the foundational layer

**Checkpoint**: Auth substrate ready â€” shared schemas, scrypt service, session CRUD + `requireSession()`, Auth.js core all green; user story implementation can begin.

---

## Phase 3: User Story 1 â€” Account Registration (Priority: P1) ðŸŽ¯ MVP

**Goal**: A visitor registers with name/email/password; valid data creates the account and signs them in; invalid or duplicate data is rejected with field-level guidance and no account is created (US1 scenarios 1â€“4).

**Independent Test**: Register with valid data (account created, signed in), then with a duplicate email (incl. case/whitespace variant) and with invalid data â€” both rejected with clear errors, no second account (quickstart S1â€“S3).

### Tests for User Story 1 (write FIRST, keep failing until the implementation lands)

- [x] T016 [P] [US1] Write the failing component tests for RegisterForm in `tests/component/RegisterForm.test.tsx` (D10, D12): labeled name/email/password fields; pending state on submit; `validation_error` â†’ inline error next to the offending field; duplicate-email error shown on the email field; non-password input preserved while the password field is cleared on failure (FR-013, FR-014)
- [x] T017 [P] [US1] Write the failing E2E registration scenarios in `tests/e2e/auth.spec.ts` (fixed dev `AUTH_SECRET` per D12): valid register â†’ `users` row with `scrypt$â€¦` passwordHash (never plaintext) + session cookie set + redirect to `/`; duplicate email incl. `John@X.com` vs `john@x.com` variant â†’ inline "already registered", exactly one account; invalid inputs (empty name, 7-char password, >254 email) â†’ per-field errors, nothing saved; double-submit â†’ at most one account (S1â€“S3 + edge cases; FR-015)

### Implementation for User Story 1

- [x] T018 [US1] Implement the `register` server action in `src/server/actions/auth-actions.ts` per contracts/server-actions.md â€” five steps visible in order: (1) validate via `registerSchema`; (2) authenticate N/A (public); (3) authorize N/A; (4) normalized email-taken check â†’ stop with email field error "This email is already registered. Try signing in instead.", else `hashPassword` â†’ create `User` (name, normalized email, passwordHash only) â†’ server-side `signIn("credentials")` which creates the first `Session`; (5) return the `ActionResult` union `{status:"success", redirectTo:"/"}` | `{status:"validation_error", fieldErrors}` | `{status:"failure", message}` â€” never a raw DB object (depends on T008, T010, T014)
- [x] T019 [US1] Create the RegisterForm client component in `src/features/auth/RegisterForm.tsx` making T016 pass: `useActionState(registerAction)`, F001 `src/components/ui/` primitives, clearly labeled fields, inline field errors, pending submit state (disabled button), password cleared on failure while name/email preserved, link to sign-in ("Already have an account? Sign in") (D10)
- [x] T020 [US1] Create the registration page `src/app/(auth)/register/page.tsx` â€” a public Server Component rendering RegisterForm (the `(auth)` group has no layout yet; it arrives with US3)
- [x] T021 [US1] Validate US1 independently: T016/T017 green; quickstart S1â€“S3 manual pass; all quality gates green; commit

**Checkpoint**: The product's front door works â€” accounts exist with hashed passwords, registration signs users in.

---

## Phase 4: User Story 2 â€” Sign In and Sign Out (Priority: P1)

**Goal**: Returning users sign in to the protected area and can sign out from any authenticated page; failures show one generic message regardless of cause (US2 scenarios 1â€“4).

**Independent Test**: Sign in with correct credentials (access granted), with a wrong password and with an unknown email (identical generic rejection), then sign out (access revoked) (quickstart S4).

### Tests for User Story 2 (write FIRST)

- [x] T022 [P] [US2] Write the failing component tests for SignInForm in `tests/component/SignInForm.test.tsx`: labeled email/password; pending state; `validation_error` â†’ inline field errors; credential failure â†’ ONE generic message ("Invalid email or password") for both wrong password and unknown email; password cleared on failure (FR-005, FR-013, FR-014)
- [x] T023 [P] [US2] Write the failing E2E sign-in/sign-out scenarios in `tests/e2e/auth.spec.ts`: correct credentials â†’ protected area; wrong password â†’ generic message; unknown email â†’ the SAME generic message (indistinguishable, no account enumeration); sign out â†’ returned to the sign-in view, session cookie cleared, `Session` row deleted (full "protected unreachable" assertions land with US3's guard) (S4; US2 scenarios 1â€“4)

### Implementation for User Story 2

- [x] T024 [US2] Implement the `signIn` and `signOut` server actions in `src/server/actions/auth-actions.ts` per contracts/server-actions.md â€” `signIn`: (1) validate via `signInSchema`; (2)â€“(3) public by definition; (4) delegate to Auth.js credentials sign-in (authorize() already performs the timing-equalized verification, D6); (5) return `success` with `redirectTo` = the `returnTo` value honored AS-IS including external URLs (clarified FR-008; default `/`) or the generic `failure("Invalid email or password")`. `signOut`: resolve the current session via `auth()`; if one exists, delete its `Session` row; clear the cookie via Auth.js signOut; return `success` with redirectTo = the sign-in view (multi-tab revocation = one DELETE, D7)
- [x] T025 [US2] Create the SignInForm client component in `src/features/auth/SignInForm.tsx` making T022 pass: `useActionState(signInAction)`, labeled fields, inline validation errors, single generic failure banner, pending state, password cleared on failure, link to registration ("Need an account? Register") (D10)
- [x] T026 [US2] Create the sign-in page `src/app/(auth)/sign-in/page.tsx` â€” a public Server Component rendering SignInForm
- [x] T027 [P] [US2] Create the SignOutButton client component in `src/features/auth/SignOutButton.tsx` â€” calls the `signOut` action, pending state (D10)
- [x] T028 [US2] Move the F001 shell into the protected group and add the authenticated header: create `src/app/(protected)/page.tsx` (the F001 application shell becomes the protected area's content per spec Assumptions) and `src/app/(protected)/layout.tsx` rendering a header with the signed-in user's name (from `auth()`) + SignOutButton; delete the old `src/app/page.tsx` to avoid the `/` route conflict; leave `src/app/layout.tsx` (ThemeProvider) untouched (FR-006, FR-012 signed-in side; depends on T027)
- [x] T029 [US2] Validate US2 independently: T022/T023 green; quickstart S4 manual pass; gates green; commit

**Checkpoint**: The daily loop works â€” sign in, use the protected shell (name + sign-out visible), sign out.

---

## Phase 5: User Story 3 â€” Protected Routes and Redirects (Priority: P1)

**Goal**: The protected area is unreachable signed-out (every attempt redirects, `?next` preserves and returns the destination), and signed-in users are bounced from the auth views (US3 scenarios 1â€“4).

**Independent Test**: Signed-out, open several protected destinations (all redirect to sign-in, zero content exposure), sign in, land on the intended destination; signed-in, open `/sign-in` and `/register` (both bounce to the protected area) (quickstart S5â€“S7).

### Tests for User Story 3 (write FIRST)

- [x] T030 [P] [US3] Write the failing E2E route-protection scenarios in `tests/e2e/auth.spec.ts`: signed-out direct open of `/` â†’ redirect to `/sign-in?next=%2F` with zero protected-content exposure; sign-in via that redirect â†’ returned to the original destination; crafted external `next` value â†’ honored as-is (accepted open-redirect posture, clarified FR-008); signed-in open of `/sign-in` and `/register` â†’ redirected to the protected area; browser Back after sign-out â†’ no protected content served (S5â€“S7; US3 scenarios 1â€“4; FR-007â€“FR-009)

### Implementation for User Story 3

- [x] T031 [US3] Create `middleware.ts` at repo root â€” the advisory edge layer (D8): cookie/JWT presence check via edge-safe `auth.config.ts` (NO Prisma/DB access), unauthenticated â†’ redirect to `/sign-in` appending `?next=<original path>`; matcher excludes `/api/health`, `/_next/*`, static assets, and the public `(auth)` routes
- [x] T032 [US3] Extend `src/app/(protected)/layout.tsx` (created in T028) with the AUTHORITATIVE guard (D8, D9): call `requireSession()` before rendering anything â€” missing/invalid session â†’ redirect to `/sign-in?next=<current path>`; a session that existed but expired (`expiresAt <= now`) â†’ same redirect plus `&reason=expired`; the header renders only after the guard passes
- [x] T033 [US3] Create `src/app/(auth)/layout.tsx` â€” the reverse guard: a valid session redirects to the protected area (FR-009; no `returnTo` handling here, per contracts/routes-and-guards.md)
- [x] T034 [US3] Validate US3 independently: T030 green incl. back-button and external-`next`; quickstart S5â€“S7 manual pass; gates green; commit

**Checkpoint**: The enforcement half is airtight â€” protected content unreachable signed-out, destinations preserved, auth views bounce signed-in users.

---

## Phase 6: User Story 4 â€” Trustworthy Sessions and Auth-State-Aware Interface (Priority: P2)

**Goal**: Identity always comes from the server-side session (forged/mismatched browser claims ignored), sessions persist across browser restarts within the sliding 30-day window, expiry is graceful, and the interface reflects auth state everywhere (US4 scenarios 1â€“5).

**Independent Test**: Present forged/mismatched identity signals (ignored), restart the browser mid-session (still signed in), rewind `expiresAt` in the dev DB (graceful redirect with clear explanation), sign out in one of two tabs (other tab revoked on its next interaction) (quickstart S8â€“S9 + S10).

### Tests for User Story 4 (write FIRST)

- [ ] T035 [P] [US4] Write the failing E2E session-trust scenarios in `tests/e2e/auth.spec.ts` (D12): forged identity â€” replay another user's identifiers against a protected action â†’ the server ignores/rejects them, server-derived identity wins (FR-010); persistence â€” sign in, close the browser context, reopen with the stored cookies â†’ still signed in within the 30-day window; expiry â€” rewind a `Session.expiresAt` to the past in the dev DB, then the next protected interaction â†’ redirect to `/sign-in` with a clear non-technical explanation; multi-tab â€” sign out in tab A â†’ tab B's next interaction redirects to sign-in (US4 scenarios 1â€“3; edge cases)

### Implementation for User Story 4

- [ ] T036 [US4] Make the expiry experience graceful: when the `(protected)` guard redirects with `reason=expired`, the sign-in view (`src/app/(auth)/sign-in/page.tsx`) shows a friendly non-technical notice ("Your session has expired. Please sign in again."); verify the sliding window via the session service â€” every protected interaction advances `expiresAt` to `now + 30 days`, no absolute cap (FR-011; makes T035's expiry scenario pass)
- [ ] T037 [US4] Verify the auth-state-aware interface end-to-end (FR-012): signed-out pages show sign-in/registration entry points and no user-specific content (the guards + public pages already ensure this); every authenticated page shows the signed-in user's name and a functioning sign-out control (from T028); fix any gap found
- [ ] T038 [US4] Validate US4 independently: T035 green (forged identity, persistence, expiry rewind, multi-tab); quickstart S8â€“S9 manual pass; gates green; commit

**Checkpoint**: Sessions are provably trustworthy â€” server-derived identity only, revocable, sliding, graceful on expiry.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final compliance sweep and full-acceptance validation of the whole feature.

- [ ] T039 [P] Update `README.md`: document `AUTH_SECRET` in the environment-variables section, refresh the local-development/database sections for the `user_auth` migration, and add an "Authentication" subsection under key architectural decisions (DB-backed revocable sessions layered on Auth.js Credentials/JWT â€” research D1/D2; timing-equalized sign-in â€” D6)
- [ ] T040 Run the FR-015/SC acceptance sweep: execute the full quickstart.md S1â€“S10 manually, run every automated gate (`npm run typecheck && npm run lint && npm run format:check && npm run test && npm run test:e2e`) on the untouched feature, confirm zero plaintext passwords in storage/logs/responses (SC-005), and commit the completed feature on `002-user-auth`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first (branch); T002/T003/T005 parallel; T004 depends on T003; T006 depends on T005
- **Foundational (Phase 2)**: Depends on Setup â€” BLOCKS all user stories. Test-before-impl pairs: T007â†’T008, T009â†’T010, T012â†’T013; T011 independent; T014 depends on T010+T013; T015 last
- **US1 (Phase 3)**: Depends on Phase 2; T016/T017 first (failing), then T018 â†’ T019 â†’ T020 â†’ T021
- **US2 (Phase 4)**: Depends on US1 (accounts must exist to sign in); T022/T023 first, then T024 â†’ T025 â†’ T026; T027 runs parallel to T024â€“T026; T028 after T027
- **US3 (Phase 5)**: Depends on US2 (the `(protected)` layout and sign-in flow it guards exist); T030 first, then T031 â†’ T032 â†’ T033 â†’ T034
- **US4 (Phase 6)**: Depends on US3 (guards) and US2 (sign-out); T035 first, then T036/T037 â†’ T038
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 â†’ US2 â†’ US3 â†’ US4** in spec priority order: each story is independently testable at its own layer once its predecessors land â€” US1/US2 E2E assert action + DB semantics, the full browser redirect matrix arrives with US3's guards, and the trust/expiry/multi-tab matrix with US4
- **US4 (P2)**: the verification-and-hardening layer over the completed P1 auth slice; nothing in it reworks earlier stories

### Parallel Opportunities

- Phase 1: T002, T003, T005 all [P]
- Phase 2: T007, T009, T011, T012 all [P] (different files)
- Within stories: T016+T017 (US1), T022+T023 (US2), T030 (US3), T035 (US4) â€” independent test-first files; T027 (US2) parallel to the action/page work
- The stories form one vertical slice, so cross-story parallelism is intentionally limited; a second developer can take the test-first files of the next story while the current story's implementation is reviewed â€” no same-file conflicts

---

## Parallel Example: User Story 2

```bash
# Launch the two independent test files together (write first, keep failing):
Task: "Component tests for SignInForm in tests/component/SignInForm.test.tsx"
Task: "E2E sign-in/sign-out scenarios in tests/e2e/auth.spec.ts"

# After the actions land, the standalone component can also go in parallel:
Task: "SignOutButton client component in src/features/auth/SignOutButton.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup â†’ 2. Phase 2: Foundational â†’ 3. Phase 3: US1
4. **STOP and VALIDATE** (quickstart S1â€“S3) â€” visitors can register and are signed in

### Incremental Delivery

1. Setup + Foundational â†’ auth substrate (shared schemas, scrypt, session service, Auth.js core)
2. US1 â†’ registration front door (MVP!)
3. US2 â†’ the daily sign-in/sign-out loop + protected shell header
4. US3 â†’ airtight route protection with preserved destinations
5. US4 â†’ proven session trust (forged identity, persistence, expiry, multi-tab) + state-aware UI
6. Polish â†’ README, full S1â€“S10 acceptance, FR-015 sweep

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The five-step server-action contract (contracts/server-actions.md) is spelled out in T018 and T024 â€” reviewers check the steps appear in order
- `passwordHash` and `Session.id` never appear in action results, page props, or logs (data-model security invariants)
- E2E expiry uses the DB `expiresAt` rewind â€” never waiting, never time-mocking (D12)
- Commit after each task or logical group; stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
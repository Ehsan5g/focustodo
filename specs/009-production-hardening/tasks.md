# Tasks: Production Hardening (F009)

**Input**: Design documents from `/specs/009-production-hardening/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md (D1–D12), data-model.md, contracts/ (environment.md, error-responses.md, deployment.md), quickstart.md (V1–V8)

**Tests**: The F008 quality gates are constitutional (Principle IV): every hardening fix lands with a failing-test-first regression test. Test tasks are therefore included per story and are mandatory.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Milestone mapping (from plan.md): US1→M6 security half, US2→M5 error handling, US3→M7 performance, US4→M7 accessibility, US5→M8 deployment, US6→M8 documentation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single full-stack Next.js project (plan.md Structure Decision): `src/app/` (App Router), `src/lib/`, `src/server/`, `prisma/`, `tests/` (unit/component/e2e), root-level infra files (`Dockerfile`, `docker-compose.yml`, `next.config.ts`), review artifacts under `docs/reviews/`. Note: the workspace currently holds only Spec Kit artifacts; the tasks below realize the plan.md target tree on the constitution's approved stack (TypeScript 5 strict, Next.js 16 App Router, React 19, Prisma, PostgreSQL 16, Zod; Vitest/RTL/Playwright for tests).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Realize the skeleton the hardening layer lands on, per plan.md Source Code tree

- [ ] T001 Create the plan.md target structure: `src/lib/`, `src/app/api/health/`, `prisma/`, `tests/unit/`, `tests/component/`, `tests/e2e/`, `docs/reviews/` directories per plan.md Source Code section
- [ ] T002 [P] Initialize `package.json` with the approved stack — next@16, react@19, typescript@5 (strict), prisma, zod, vitest, @testing-library/react, playwright, eslint, prettier — plus the single approved devDependency `@axe-core/playwright` (research D10; no new runtime libraries)
- [ ] T003 [P] Configure tooling: `next.config.ts` skeleton, `tsconfig.json` strict mode, ESLint + Prettier configs, and npm scripts `dev`, `build`, `lint`, `typecheck`, `test` in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The three `src/lib` modules, security headers, and the schema every user story consumes

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create `src/lib/env.ts` — Zod schema per contracts/environment.md: `DATABASE_URL` (required, URL format), `AUTH_SECRET` (required, min length 32), `NODE_ENV` enum; validated once at module load; on failure exit with one readable error naming every problem (FR-016, SC-008; research D4); imported by `src/server/db` and the Auth.js config so nothing initializes unconfigured
- [ ] T005 [P] Create `src/lib/errors.ts` — typed error catalog per contracts/error-responses.md: closed `ErrorCode` union (VALIDATION, AUTH_INVALID_CREDENTIALS, AUTH_RATE_LIMITED, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, DATABASE, NETWORK, UNEXPECTED) each mapping to its exact user message and server log level; `ActionResult<T>` result shape (FR-007)
- [ ] T006 [P] Add security headers to `next.config.ts` `headers()` per research D11: X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy (camera/microphone/geolocation denied), HSTS in production, pragmatic CSP baseline with documented nonce upgrade path
- [ ] T007 [P] Create `prisma/schema.prisma` with the unchanged F002–F004 entities (User, Task with title 1–120 / description ≤1000 / status TODO|IN_PROGRESS|COMPLETED / priority LOW|MEDIUM|HIGH, Category name unique per user) and the `db push`/`migrate dev` workflow in `package.json` scripts
- [ ] T008 Write-first verification: unit tests for `src/lib/env.ts` (missing var → startup error names it; AUTH_SECRET <32 chars → rejected; valid config → loads) in `tests/unit/env.test.ts` confirming fail-fast BEFORE any story consumes it (FR-016)

**Checkpoint**: Foundation ready — env validation, error catalog, headers, and schema in place; user story implementation can begin

---

## Phase 3: User Story 1 — A Security Review Proves the App Is Safe to Expose (Priority: P1) 🎯 MVP

**Goal**: A checklist-driven review walks every account/task/category operation re-proving the five-step contract, re-proves cross-user denials through every path, audits secrets, dependencies, password/session handling, and makes login brute-force throttling a blocking item — every finding closed before release (FR-001–FR-006, SC-001–SC-003, SC-006; milestone M6 security half).

**Independent Test**: Execute the review checklist across all operations; every cross-user probe denied with a generic response, zero secrets in code/config/images, throttle in place — app proven deployable.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create `src/lib/rate-limit.ts` — dependency-free in-memory fixed-window limiter per research D1/data-model.md: `RateLimitBucket` keyed `${email}|${ip}`, MAX_FAILURES = 5, WINDOW_MS = 900000 (15 min); pure functions with injectable clock; lifecycle absent→counting→throttled→expired-or-reset; buckets never logged (FR-001, SC-006)
- [ ] T010 [US1] Write-first regression tests for the throttle in `tests/unit/rate-limit.test.ts` — below threshold generic "Invalid email or password.", at 5th failure AUTH_RATE_LIMITED with "Too many sign-in attempts. Please try again later.", window expiry, success reset, only failures count (research D2; quickstart V3); must FAIL before T011 wires it in
- [ ] T011 [US1] Wire the throttle into the login server action / Auth.js `authorize` step in `src/server/actions/` BEFORE credential verification (FR-001; depends on T009, T010; blocking review item per clarify Q2)
- [ ] T012 [US1] Create `docs/reviews/security-review.md` with the finding schema from data-model.md (`id, severity (blocker|major|minor), finding, evidence, resolution, verified-by`) and the seven review areas as checklist sections; walk every account, task, and category operation re-proving the five-step contract (FR-001); record findings to resolution or documented acceptance (FR-001, FR-013, SC-001)
- [ ] T013 [P] [US1] Cross-user denial re-proof: re-run/extend the F008 denial matrix (`tests/e2e/security/cross-user-denial.spec.ts`) across every supported path including directly crafted requests, generic responses only (FR-002, SC-002)
- [ ] T014 [P] [US1] Secrets audit: credential-pattern grep over the working tree (0 hits), verify `.gitignore` excludes `.env*`, inspect the built image for secrets, confirm all sensitive values arrive only via env config (FR-003, SC-003; quickstart V2); re-run after repo init per research.md Repository state
- [ ] T015 [P] [US1] Dependency audit: `npm audit --omit=dev` with every high/critical resolved or explicitly accepted with written rationale in `docs/reviews/security-review.md` (FR-004; quickstart V2)
- [ ] T016 [P] [US1] Password & session handling review: hashes and sensitive auth data never exposed to the client, nothing sensitive logged in plaintext; screen logs against the never-log list in contracts/error-responses.md (passwords, tokens, cookies, request bodies, raw SQL, env values, bucket contents) (FR-005); findings into `docs/reviews/security-review.md`
- [ ] T017 [US1] Close the review: every security fix lands with its failing-test-first regression test in the F008 suite (`tests/unit/`, `tests/e2e/security/`); authorization findings block all other work until resolved; zero open blocker/major findings (FR-006, SC-001; depends on T012–T016)

**Checkpoint**: Security review passes with zero open blocker/major findings; throttle live and tested; secrets audit clean

---

## Phase 4: User Story 2 — Nothing Fails Rudely — Graceful Error Handling Everywhere (Priority: P1)

**Goal**: Every failure class produces a friendly message, preserved input, a recoverable state, and server-side-only diagnostics — via the error catalog, three App Router boundaries, and logging discipline (FR-007–FR-009, SC-006; milestone M5).

**Independent Test**: Force each error class → friendly message, preserved input, recoverable state, complete server-side logging, zero technical leakage (quickstart V4/V5).

### Implementation for User Story 2

- [ ] T018 [P] [US2] Create `src/app/error.tsx` — segment-level fallback per contracts/error-responses.md: friendly message with a "Try again" (reset) action (FR-009)
- [ ] T019 [P] [US2] Create `src/app/global-error.tsx` — minimal root crash fallback with reload guidance; on double failure show the built-in fallback message, never a blank screen (Edge Case; FR-009)
- [ ] T020 [P] [US2] Create `src/app/not-found.tsx` — friendly 404 with a link back to the dashboard (FR-009)
- [ ] T021 [US2] Wire server actions to the catalog: map every thrown/failed operation to its `ErrorCode` → user-safe message per contracts/error-responses.md; input preserved on failure; server logs carry timestamp, code, message, stack (error/warn), userId, route/action — never passwords, tokens, cookies, request bodies, raw SQL, env values, or bucket contents (FR-007, FR-008)
- [ ] T022 [US2] Write-first E2E/component coverage in `tests/e2e/resilience/` + `tests/component/error-boundaries.test.tsx`: forced DB failure (`docker compose stop db`) → "Something went wrong. Please try again." with no stack/SQL in the UI and recovery without app restart (quickstart V4); nonexistent URL → friendly not-found (V5); dev-flag render error → boundary fallback with working "Try again" (V5); must FAIL before T018–T021 complete, then pass (SC-006)

**Checkpoint**: 100% of forced failure classes → friendly message, preserved input, server-side log; zero stack traces or internals reach the client

---

## Phase 5: User Story 3 — A Performance Review Confirms the App Stays Fast (Priority: P2)

**Goal**: Measure every interaction against the strict budgets (≤500 ms list/filter/sort; ≤1 s dashboard/search/submit) on the 2-core/4 GB baseline with the ~300-task reference dataset; every miss fixed or explicitly accepted (FR-010, FR-011, SC-004; milestone M7; research D8–D9).

**Independent Test**: Load the reference dataset on the production build, measure each interaction on the baseline, confirm every result recorded with misses fixed or explicitly accepted (quickstart V6).

### Implementation for User Story 3

- [ ] T023 [P] [US3] Create `prisma/seed.ts` — ~300-task reference dataset across 8 categories with varied status/priority/dueDate spread (research D8); wire `prisma db seed` in `package.json`
- [ ] T024 [US3] Index plan migration: deliver indexes `Task(userId)`, `Task(userId, dueDate)`, `Task(userId, status)`, `Task(userId, priority)`, `Task(userId, categoryId)`, `Category(userId)` as a Prisma migration in `prisma/migrations/` (data-model.md; research D9); final minimal set confirmed via `EXPLAIN ANALYZE` before the budget run
- [ ] T025 [P] [US3] Create `tests/e2e/performance.spec.ts` — second-navigation (warm cache) measurements of list render, filter apply, sort toggle (≤500 ms) and dashboard load, search results, form submit (≤1 s) against the production build on the 2-core/4 GB baseline (FR-010; research D8; quickstart V6); write-first: fails while budgets unmeasured
- [ ] T026 [US3] Run the budget suite and record every result in `docs/reviews/performance-review.md` (data-model.md finding schema); append `EXPLAIN ANALYZE` evidence of index usage on the hot list query; fix every miss (starting from a failing test per the F008 gates) or record explicit written acceptance (FR-011, SC-004; depends on T023–T025)

**Checkpoint**: 100% of budgets met on the reference dataset + baseline hardware, or carried as written explicit acceptance

---

## Phase 6: User Story 4 — An Accessibility Review Confirms Everyone Can Use It (Priority: P2)

**Goal**: Real keyboard-only completion of registration→logout, NVDA (Windows, Chrome + Firefox) plus one mobile screen reader (VoiceOver iOS or TalkBack) traversal of key pages, contrast, and never color-only status/priority (FR-012, SC-005; milestone M7; research D10).

**Independent Test**: Complete registration through logout keyboard-only with visible focus and no traps; NVDA + one mobile SR announce content/states/errors; status/priority never color-only (quickstart V7).

### Implementation for User Story 4

- [ ] T027 [P] [US4] Add the automated axe baseline: `tests/e2e/accessibility/axe.spec.ts` with `@axe-core/playwright` over key pages — critical violations fail the suite (research D10; devDependency already in T002)
- [ ] T028 [US4] Create `docs/reviews/accessibility-review.md` (data-model.md finding schema) and execute the manual matrix: keyboard-only pass over registration → login → create → edit → complete → filter → logout with visible focus and no traps; NVDA on Windows across Chrome + Firefox announcing content/states/errors on key pages; one mobile screen reader (VoiceOver iOS or TalkBack) over the mobile journeys; contrast verified; status/priority never by color alone (FR-012, SC-005); automated-pass-but-real-AT-fails discrepancies are defects to fix under the F008 gates, not documented limitations (Edge Case); depends on T027

**Checkpoint**: Critical journeys keyboard-only complete; NVDA + mobile SR passes recorded; axe baseline green

---

## Phase 7: User Story 5 — The App Runs Identically Anywhere — Containers and Configuration (Priority: P2)

**Goal**: One-command containerized startup, complete env template, fail-fast validation in practice, secret-free images (FR-014–FR-017, SC-007, SC-008; milestone M8; contracts/deployment.md, contracts/environment.md).

**Independent Test**: On a clean machine follow the one-command startup → fully usable app; remove a required config value → fail-fast message naming it (quickstart V1 + Setup A).

### Implementation for User Story 5

- [ ] T029 [P] [US5] Create `.env.example` — every variable (required and optional) with safe placeholders and inline comments per contracts/environment.md; stays in sync with `src/lib/env.ts` (checked in security review); create/verify `.gitignore` excludes `.env*` (FR-015)
- [ ] T030 [P] [US5] Create `.dockerignore` — excludes node_modules, .next, .git, `.env*`, specs, docs (contracts/deployment.md)
- [ ] T031 [US5] Create `Dockerfile` per contracts/deployment.md: multi-stage deps/build/runner on node:22-alpine, `next build` with `output: 'standalone'` + `prisma generate`, non-root `nextjs` user, `NODE_ENV=production`, HEALTHCHECK, entrypoint runs `npx prisma migrate deploy` before `node server.js` on port 3000 (FR-014, FR-017)
- [ ] T032 [US5] Create `docker-compose.yml` per contracts/deployment.md: `db` (postgres:16-alpine, named volume `pgdata`, `pg_isready` healthcheck, port 5432 host-exposed) + `app` (build: ., 3000:3000, env_file `.env`, DATABASE_URL at `db:5432`, `depends_on: db: condition: service_healthy`, HTTP healthcheck on `/api/health`); `restart: unless-stopped` on both (FR-014)
- [ ] T033 [P] [US5] Create `src/app/api/health/route.ts` — returns 200 `{"status":"ok"}`; 503 when the database is unreachable (contracts/deployment.md + HTTP mapping in contracts/error-responses.md)
- [ ] T034 [US5] Startup resilience: app startup waits and retries while the database is not ready with clear status messaging instead of crash-looping silently (Edge Case); verify migration retry behavior in the container entrypoint of `Dockerfile`
- [ ] T035 [US5] Deployment validation: fresh `docker compose up --build` on a clean machine → db healthy → migrations applied → app healthy on http://localhost:3000 under 15 minutes cold (SC-007); both services healthy in `docker compose ps`; app container non-root; `curl -f http://localhost:3000/api/health` returns `{"status":"ok"}`; built image contains no secrets (FR-017, SC-003 cross-check with T014); then quickstart V1: rename `AUTH_SECRET` → fail-fast startup error names it, restore → boots (SC-008; depends on T029–T034)

**Checkpoint**: One command from clean machine to usable app in under 15 minutes; fail-fast env validation proven; secret-free image

---

## Phase 8: User Story 6 — The README Makes the Project Self-Explanatory (Priority: P3)

**Goal**: A README covering the full constitution-mandated topic list, current with the shipped reality (FR-018; research D12).

**Independent Test**: A fresh contributor follows the README top to bottom on a clean machine and reaches a running, tested application without outside help (quickstart V8).

### Implementation for User Story 6

- [ ] T036 [US6] Create `README.md` with the research D12 section list: What is FocusTodo, Features, Tech Stack, Architecture, Project Structure, Environment Variables (purpose/format/default for every variable — FR-018), Local Development, Database Setup, Testing, E2E Tests, Deployment (Docker), AI-Assisted Workflow, Key Architectural Decisions; the Local Development path mirrors quickstart Setup B and reaches a running app

**Checkpoint**: README complete per the mandated topic list; newcomer path verified end to end

---

## Phase 9: Polish & Cross-Cutting Concern

**Purpose**: Improvements that span multiple user stories

- [ ] T037 [P] Documentation sync: `.env.example` ↔ `src/lib/env.ts` ↔ README env table (contracts/environment.md sync rule); record the in-memory-throttle restart limitation and the pragmatic-CSP upgrade path as documented acceptances in `docs/reviews/security-review.md`
- [ ] T038 [P] Code cleanup: remove dead code/duplication introduced during hardening; ensure no `any`, no new type assertions, no unnecessary libraries (constitution II/III)
- [ ] T039 Run `quickstart.md` validation end to end: V1 (fail-fast env), V2 (security review checks), V3 (throttle), V4 (graceful DB failure), V5 (boundaries), V6 (budgets), V7 (accessibility), V8 (README & gates) — all pass
- [ ] T040 Final gates: `npm run lint`, `npm run typecheck`, full unit/component/E2E suites in `tests/` green; F008 security E2E (`tests/e2e/security/`) still passing; zero open blocker/major review findings (SC-001)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — starts immediately
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories (env.ts, errors.ts, headers, schema)
- **US1 (Phase 3)**: first story after Foundational — security findings block all other work (FR-006); the throttle (T009–T011) is a blocking review item
- **US2 (Phase 4)**: after Foundational; independent of US1 (reuses foundational `src/lib/errors.ts`)
- **US3 (Phase 5)**: after Foundational; T026 depends on T023–T025; final budget run needs the compose stack from US5 for a baseline-faithful measurement
- **US4 (Phase 6)**: after Foundational; T028 depends on T027
- **US5 (Phase 7)**: after Foundational; T035 depends on T029–T034
- **US6 (Phase 8)**: last story — documents the final state of env vars, deployment, and tests
- **Polish (Phase 9)**: depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundational → T009 ∥ T013–T016 → T010 (failing tests) → T011 (wire throttle) → T012 → T017
- **US2 (P1)**: Foundational → T018–T020 (parallel) → T021 → T022
- **US3 (P2)**: Foundational → T023 ∥ T025 → T024 → T026
- **US4 (P2)**: Foundational → T027 → T028
- **US5 (P2)**: Foundational → T029–T030, T033 (parallel) → T031, T032 (parallel) → T034 → T035
- **US6 (P3)**: after US1–US5 stabilize → T036

### Within Each User Story

- Tests written FIRST and confirmed FAILING before the implementation that satisfies them (constitution IV; F008 gates)
- Lib modules before integration wiring; core implementation before review/recording tasks
- Story complete (checkpoint) before moving to the next priority

### Parallel Opportunities

- Setup: T002, T003 in parallel after T001
- Foundational: T005, T006, T007 in parallel (T004 first — others may import it)
- US1: T009 ∥ T013–T016; T012 independent of the throttle pair
- US2: T018–T020 in parallel; independent of US1 (different files)
- US3: T023 ∥ T025; T024 before the final budget run
- US5: T029, T030, T033 in parallel; T031, T032 in parallel after T030
- Different user stories proceed in parallel once Foundational completes

---

## Parallel Example: User Story 1

```bash
# After Foundational, launch the throttle module and the review evidence gathers together:
Task: "Create src/lib/rate-limit.ts in-memory fixed-window limiter (T009)"
Task: "Secrets audit — grep working tree, .gitignore, image inspection (T014)"
Task: "Dependency audit — npm audit --omit=dev (T015)"
Task: "Password & session handling review (T016)"

# Then serially: T010 (failing tests) → T011 (wire throttle) → T012 (checklist) → T017 (close)
```

## Parallel Example: User Story 5

```bash
# Infra files are disjoint — launch together:
Task: ".env.example + .gitignore verification (T029)"
Task: ".dockerignore (T030)"
Task: "src/app/api/health/route.ts (T033)"

# Then the container pair:
Task: "Dockerfile multi-stage standalone non-root (T031)"
Task: "docker-compose.yml db + app with healthchecks (T032)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — throttle implemented, security review executed, all findings closed
4. **STOP and VALIDATE**: quickstart V2 + V3 pass; zero open blocker/major findings; app proven safe to expose
5. Security fixes block all other work until resolved (FR-006)

### Incremental Delivery

1. Setup + Foundational → hardening base ready
2. US1 → security proven (MVP gate) → V2/V3 pass
3. US2 → graceful failure → V4/V5 pass
4. US5 → one-command deployment → V1 + Setup A pass (unlocks US3's baseline-faithful budget run)
5. US3 + US4 (parallel) → budgets met + accessibility verified → V6/V7 pass
6. US6 → README → V8 pass → Polish T037–T040 → feature complete

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done: Developer A: US1 (security) · Developer B: US2 (errors) · Developer C: US5 (containers)
3. US3 + US4 follow (C hands compose to the budget run; A/B pick up a11y + perf)
4. Developer A closes with US6 + Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps the task to its user story for traceability; FR-xxx/SC-xxx tags map to spec requirements
- Review artifacts under `docs/reviews/` are explicit deliverables with the data-model.md finding schema (`id, severity (blocker|major|minor), finding, evidence, resolution, verified-by`); a review passes when no blocker/major findings remain open
- The in-memory throttle restart limitation and pragmatic CSP baseline are documented acceptances, not silent gaps (research D1, D11)
- No new runtime libraries — `@axe-core/playwright` is the single approved devDependency
- Verify tests fail before implementing; commit after each task or logical group; stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence

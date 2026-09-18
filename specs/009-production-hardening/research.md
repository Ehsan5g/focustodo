# Research: Production Hardening (F009)

**Feature**: `specs/009-production-hardening` | **Date**: 2026-09-16 | **Status**: all unknowns resolved

## Repository state (read first)

This workspace contains only Spec Kit artifacts (`.specify/`, `specs/`) — no implementation code, `package.json`, or git history exist yet. Features 001–008 define the application surface this feature hardens, and the constitution fixes the stack. This plan therefore designs the hardening layer against the constitution's approved stack and the accumulated spec decisions; `/speckit-tasks` turns it into concrete implementation work. Consequence for research item 5: with no git history, the "no committed secrets" audit scans the working tree and verifies `.gitignore` prevention, and is re-run once the repository is initialized.

## Decisions

### 1. Login brute-force throttling mechanism
- **Decision**: Dependency-free in-memory fixed-window limiter in `src/lib/rate-limit.ts`, keyed by `email|ip` — 5 failed attempts per 15-minute window, then blocked with a "too many attempts" response until the window expires or a success resets the counter. Enforced inside the login server action / Auth.js `authorize` step before credential verification.
- **Rationale**: Single-instance deployment is a documented spec assumption, so cross-instance shared state is unnecessary; honors "no unnecessary libraries"; pure functions with an injectable clock are trivially unit-testable; GWT-4 makes a missing throttle a blocking finding.
- **Alternatives considered**: `@upstash/ratelimit` (requires external service + new dependency — rejected); database-backed attempt table (survives restarts but adds schema, queries, and cleanup for a personal app — rejected); full account lockout with email-based unlock (new user-facing capability, excluded by spec constraints — rejected).

### 2. Throttle response semantics
- **Decision**: Below threshold: generic "Invalid email or password". At/above threshold: "Too many sign-in attempts. Please try again later." Only failed attempts count toward the threshold.
- **Rationale**: Keeps account-enumeration resistance below threshold (OWASP guidance) while making the throttle observable, which GWT-4 and the security review require.
- **Alternatives considered**: always-generic message (throttle unverifiable from the UI — rejected); email-specific "account locked" messages (enumeration signal — rejected).

### 3. Error-handling architecture
- **Decision**: A central error catalog (`src/lib/errors.ts`) maps error codes to user-safe messages; App Router boundaries `error.tsx`, `global-error.tsx`, `not-found.tsx` catch render/segment failures; server actions keep the predictable result shape per the five-step contract; unexpected errors are logged server-side (code, message, stack, userId) and surfaced to the client as a generic failure.
- **Rationale**: Constitution V requires friendly messages for every error class without leaking server/database details; one catalog prevents message drift across features; boundaries are the framework-native mechanism.
- **Alternatives considered**: toast-only global handler (misses segment crashes and 404s — rejected); i18n-ready message catalog (app is English-only; YAGNI — rejected).

### 4. Environment configuration & fail-fast validation
- **Decision**: `src/lib/env.ts` defines a Zod schema (DATABASE_URL, AUTH_SECRET required; AUTH_SECRET ≥ 32 chars) validated once at module load, throwing a readable startup error that lists every missing/invalid variable; `.env.example` documents every variable including optionals. Imported by the Prisma client module and auth config so nothing runs unconfigured.
- **Rationale**: Constitution II makes Zod the single source of truth for contracts; the spec requires fail-fast on missing/misconfigured environment; Next.js loads `.env` natively so no dotenv dependency is needed.
- **Alternatives considered**: scattered `process.env` checks (drift-prone, late failures — rejected); `@t3-oss/env-nextjs` (new dependency for marginal gain — rejected).

### 5. Secrets & dependency audit method
- **Decision**: Working-tree scan for credential patterns (AKIA…, `BEGIN PRIVATE KEY`, `ghp_`, `sk-`, non-placeholder `AUTH_SECRET=`), verify `.gitignore` excludes `.env*` and key material, and gate `npm audit --omit=dev` at no high/critical vulnerabilities; results recorded in `docs/reviews/security-review.md`.
- **Rationale**: Satisfies the "no committed secrets" and dependency-hygiene requirements with zero new tooling; the missing git history is recorded as N/A-now / re-run-later (see Repository state).
- **Alternatives considered**: gitleaks/trufflehog (good tooling, but adoptable after repo init — noted as optional follow-up, deferred).

### 6. Container strategy
- **Decision**: Multi-stage `Dockerfile` (deps → build with `output: 'standalone'` → slim runner as non-root user, `NODE_ENV=production`) plus `docker-compose.yml` with `db` (postgres:16-alpine, `pg_isready` healthcheck, named volume) and `app` (healthcheck against `/api/health`, `depends_on: db: service_healthy`, entrypoint runs `prisma migrate deploy` before `node server.js`); `.dockerignore` keeps images small. One command: `docker compose up --build`.
- **Rationale**: Standalone output produces a minimal production image; non-root execution and healthchecks are explicit spec FRs; Compose is already the sanctioned local-infrastructure mechanism.
- **Alternatives considered**: VM/PM2 install guide (not container-first — rejected); Kubernetes/Helm (operations overkill for a personal app — rejected).

### 7. Health endpoint
- **Decision**: `/api/health` Route Handler, public and unauthenticated, checks Prisma connectivity (`SELECT 1`) and returns `{ status: "ok" }` (200) or 503 on failure.
- **Rationale**: The compose healthcheck must reflect real readiness; the constitution permits Route Handlers "only where appropriate" — a liveness/readiness probe is that case.
- **Alternatives considered**: static 200 (masks database outages — rejected); authenticated health page (orchestrated healthchecks cannot hold a session — rejected).

### 8. Performance measurement methodology
- **Decision**: `prisma/seed.ts` builds the reference dataset (~300 tasks across 8 categories with varied status/priority/dueDate spread); `tests/e2e/performance.spec.ts` measures the production build — list render, filter apply, sort toggle (≤500 ms) and dashboard load, search results, form submit (≤1 s), using second-navigation timings (warm cache) — executed on the clarified 2-core/4 GB baseline; hot queries verified with `EXPLAIN ANALYZE`; results recorded in `docs/reviews/performance-review.md`.
- **Rationale**: SC-004 demands strict, reproducible budgets on defined hardware; Playwright is already the sanctioned E2E tool, so no new tooling; index decisions follow constitution III.
- **Alternatives considered**: Lighthouse CI (aggregate scores, not interaction latency — rejected); k6 load testing (single-user app; concurrency is not the risk — rejected).

### 9. Index plan (verification, not invention)
- **Decision**: Verify/create indexes matching query patterns: `Task(userId)`, `Task(userId, dueDate)` (default sort), `Task(userId, status)`, `Task(userId, priority)`, `Task(userId, categoryId)`, `Category(userId)`; the final minimal set is confirmed by `EXPLAIN ANALYZE` during the review and delivered as a migration before the performance run.
- **Rationale**: Constitution III mandates index evaluation against actual query patterns; guarantees the 500 ms budget holds as data grows beyond the seed.
- **Alternatives considered**: single-column indexes only (compound filter+sort patterns need compounds — rejected); wait for observed slowness (violates the budget-first review — rejected).

### 10. Accessibility verification tooling
- **Decision**: Manual matrix per clarify Q3 — NVDA on Windows (Chrome + Firefox) across all key pages, plus one mobile screen reader (VoiceOver on iOS or TalkBack on Android) for the mobile journeys — findings recorded per page in `docs/reviews/accessibility-review.md`; supplemented by an automated `@axe-core/playwright` baseline (devDependency) where critical violations fail the suite.
- **Rationale**: Q3 mandates the matrix; real screen-reader behaviors (announcements, virtual-buffer navigation) cannot be automated; axe adds a repeatable regression signal at zero runtime cost.
- **Alternatives considered**: axe-only (misses SR announcement quality — rejected); automated screen-reader drivers (unreliable/flaky — rejected).

### 11. Security headers
- **Decision**: `next.config.ts` `headers()` sets X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy (camera/microphone/geolocation denied), and HSTS in production; CSP starts as a pragmatic baseline (`script-src 'self' 'unsafe-inline'` etc.) with a documented nonce-based upgrade path.
- **Rationale**: The spec requires standard hardening headers on all responses; Next.js has no nonce pipeline by default, so a full strict CSP would touch every inline script without a clarifying requirement — recorded as a known limitation with an upgrade path instead of blocking the review.
- **Alternatives considered**: full nonce-based CSP now (high regression surface, no spec pressure — deferred, documented); no CSP (fails "standard hardening headers" — rejected).

### 12. README structure
- **Decision**: Single `README.md` with sections: What is FocusTodo, Features, Tech Stack, Architecture, Project Structure, Environment Variables, Local Development, Database Setup, Testing, E2E Tests, Deployment (Docker), AI-Assisted Workflow, Key Architectural Decisions — the constitution-mandated topic list plus deployment.
- **Rationale**: The constitution requires a professional README covering exactly these topics; one file serves the target audience (new contributor/reviewer) best at this scale.
- **Alternatives considered**: a `docs/` split (overkill for a personal app — rejected).
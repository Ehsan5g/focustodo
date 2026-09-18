# Research: Project Foundation & Tooling (F001)

**Feature**: `specs/001-project-foundation` | **Date**: 2026-09-16

## Repository state

The workspace currently contains only Spec Kit artifacts (`.specify/`, `specs/001-project-foundation/`, `specs/009-production-hardening/`) — no `package.json`, no source tree, no git history. F001's deliverable IS this tree: every path in plan.md's source layout is created by this feature's tasks. Because no git repository exists yet, repo bootstrap (git init; initial commit on `001-project-foundation` with `.gitignore` committed before any code) is an explicit task of this feature, and the "no committed secrets" guarantee (FR-012) is enforced from the first commit onward.

## Decisions

### 1. Package manager: npm
- **Decision**: npm (bundled with Node.js), with a committed `package-lock.json`.
- **Rationale**: SC-001 wants a ≤15-minute, prerequisites-light setup; npm needs zero extra installation steps beyond Node itself. A lockfile pins the whole toolchain for reproducibility (US1).
- **Alternatives considered**: pnpm / yarn (faster installs and disk savings, but they add a corepack/enable step to every documented prerequisite list — rejected as unnecessary at this scale; revisit only if install times become a pain point).

### 2. Runtime pin: Node.js 22 LTS
- **Decision**: Node 22 LTS pinned via `.nvmrc` and `engines` in package.json; documented as the version prerequisite.
- **Rationale**: Current LTS line; matches the container base image already chosen in F009's plan (node:22-alpine), so local dev and any future container run the same major. Prevents "works on my Node" drift (US1).
- **Alternatives considered**: "any current LTS" (spec wording) — a documented exact major removes ambiguity at zero cost; Node 24 (too new for the widest tool compatibility at authoring time — rejected).

### 3. Framework versions and dev tooling
- **Decision**: Next.js 16 current stable with App Router and its paired React major; dev server on Turbopack (Next 16 default). `next.config.ts` stays minimal in F001 — notably `output: 'standalone'` is NOT set here; the container build adds it in F009.
- **Rationale**: The constitution fixes the stack; using each tool's current stable defaults minimizes custom configuration the README must explain (SC-003).
- **Alternatives considered**: webpack fallback flags (no benefit on a fresh project — rejected); standalone output now (premature — no container exists in F001; F009 owns deployment).

### 4. Theme persistence: native implementation, no library
- **Decision**: A small custom `ThemeProvider` in `src/components/theme/`: values `light | dark | system`, default `system` on first visit; explicit choice persisted in `localStorage` key `focustodo-theme`; a tiny inline script in the root layout applies the saved choice (or `matchMedia('(prefers-color-scheme: dark)')`) to the `<html>` class before hydration so there is no wrong-theme flash; `useTheme()` exposes `{theme, setTheme}` to the toggle.
- **Rationale**: FR-010 + Key Entities define exactly this behavior, and it fits in ~50 lines — the constitution's "no unnecessary libraries; prefer native capabilities" rule makes `next-themes` an avoidable runtime dependency.
- **Alternatives considered**: next-themes (proven, but an avoidable runtime dep for a solved problem — rejected); CSS-only `light-dark()` without JS (cannot persist an explicit user choice across visits — rejected); persisting in the database (spec says per-browser, and no auth exists — rejected).

### 5. Linting and formatting
- **Decision**: ESLint 9 flat config extending `eslint-config-next`, plus project rules: `@typescript-eslint/no-explicit-any` = error and `no-console` = error (FR-014's "no debug logging"); Prettier with `prettier-plugin-tailwindcss` for deterministic class ordering; scripts `lint`, `format:check`, `format` per FR-004.
- **Rationale**: FR-004 demands enforceable gates that pass untouched (US2) and fail on a deliberate defect (US2 scenario 6); Tailwind class sorting prevents noisy diffs in later features.
- **Alternatives considered**: Biome (single fast tool, but the approved stack names ESLint + Prettier — rejected); husky/lint-staged pre-commit hooks (no git repo exists yet and CI is out of scope; hooks can be added later without a spec change).

### 6. Unit and component testing
- **Decision**: Vitest with one `vitest.config.ts`: node environment for pure-logic tests, jsdom (+ `@testing-library/react`) for component tests via per-file environment annotations; `tests/setup.ts` for shared RTL setup; scripts `test` (run once, gate) and `test:watch`. Sample tests: a pure schema/logic unit test and a rendered-shell component test (FR-005).
- **Rationale**: The approved stack; one runner with two environments keeps SC-002's <1-minute budget and the single documented command (US2).
- **Alternatives considered**: separate configs per environment (extra moving parts — rejected); Jest (slower TS setup; the stack says Vitest — rejected).

### 7. End-to-end smoke testing
- **Decision**: Playwright with Chromium only for the smoke suite; `playwright.config.ts` uses `webServer` to auto-start `npm run dev` (port 3000, `reuseExistingServer: true`) with `baseURL http://localhost:3000`; the documented one-time runtime installation command is `npx playwright install chromium` (edge case: first run on a new machine); the smoke spec asserts the app loads and the primary shell is visible (FR-006); script `test:e2e`.
- **Rationale**: SC-002's <5-minute budget and US2's "one documented command"; a full browser matrix belongs to later features' fuller E2E suites (F008/F009), not the foundation smoke.
- **Alternatives considered**: auto-start the production build for smoke (slower inner loop; F009 uses the prod build where it matters — rejected for F001); require a manually started server only (contradicts "one documented command" — rejected).

### 8. Prisma baseline: zero-model schema, migration-managed
- **Decision**: `prisma/schema.prisma` contains only the datasource (postgresql, `env("DATABASE_URL")`) and generator (prisma-client-js) — no models. Schema management on a brand-new empty database is a single documented command: `npm run db:migrate` (`prisma migrate dev`), which initializes the `_prisma_migrations` history; `npm run db:deploy` (`prisma migrate deploy`) is documented for scripted recreate-from-zero (FR-008). Business models/migrations accumulate from later features.
- **Rationale**: The spec's Database Baseline is explicitly EMPTY ("no business tables beyond what schema management requires"); this satisfies FR-007/FR-008 while keeping the baseline clean.
- **Alternatives considered**: an empty placeholder migration (adds nothing — rejected); `prisma db push` (no migration history — violates "migration-managed" — rejected).

### 9. Docker Compose: local database only
- **Decision**: `docker-compose.yml` defines a single `db` service (postgres:16-alpine) with a named volume, `pg_isready` healthcheck, host port 5432, and credentials from `.env`; documented command `npm run db:up` (docker compose up -d db). The application container and Dockerfile are deliberately deferred to F009 (the deployment feature).
- **Rationale**: F001's compose exists only to host the disposable local PostgreSQL (FR-007); keeping it db-only matches the spec's out-of-scope list (no deployment) and leaves F009's app-service extension clean.
- **Alternatives considered**: native Postgres install instructions (defeats the documented Docker prerequisite and the disposal story — rejected); app service now (out of scope for F001 — rejected).

### 10. Environment validation scope
- **Decision**: `src/lib/env.ts` validates at module load with Zod: `DATABASE_URL` required (URL format); `NODE_ENV` framework-set enum. On failure the process exits with one actionable message naming every problem (FR-012). `AUTH_SECRET` and feature-specific variables are intentionally ABSENT until their features arrive — each later feature extends this module and updates `.env.example` in the same change (extension convention in contracts/environment.md; F009's plan already assumes this file exists).
- **Rationale**: Fail-fast posture without inventing configuration nothing uses yet; keeps `.env.example` honest (every listed variable is real and validated).
- **Alternatives considered**: ship an AUTH_SECRET placeholder now (an unused required variable would fail startup — rejected); ad-hoc manual checks scattered in code (no single source of truth — rejected).

### 11. Health verification: write-read round trip via /api/health
- **Decision**: A public GET Route Handler at `/api/health` performs a real round trip: it ensures a scratch table `health_check` exists (`CREATE TABLE IF NOT EXISTS` — the table name is a code constant and no user input reaches the statement, so it is injection-safe; values are bound as parameters), upserts a singleton row (checked_at timestamp + attempt counter), reads it back, and returns 200 `{status:"ok", lastCheckedAt, attempts}`; on database failure it returns 503 with a remediation hint (how to start the db) and no internals. Repeated calls across a full app+db restart observe the counter continuing — the persistence proof for SC-005.
- **Rationale**: FR-009 demands a write-read round trip and SC-005 demands the written data persists, but the Database Baseline must stay schema-empty (spec Key Entities) — a runtime-created scratch table satisfies both without adding a business/infra table to the migrations. The same endpoint is what F009's plan reuses as the container healthcheck.
- **Alternatives considered**: SELECT-1 probe only (no write-read proof — rejected); a HealthCheck table in the Prisma schema (violates the empty-baseline requirement — rejected); a dev-only page with a button (not machine-checkable as a gate — rejected).

### 12. README content and command contract
- **Decision**: One `README.md` covering the constitution's mandated topics (product, features, tech stack, architecture, project structure, environment variables, local development, database setup, tests, E2E tests, AI-assisted workflow, key architectural decisions) plus troubleshooting for the spec's edge cases (port in use, database unreachable, first E2E browser install). Every command is executable verbatim (SC-003) and mirrors contracts/commands.md.
- **Rationale**: FR-013 + SC-001 (15-minute fresh-clone setup) make the README the feature's primary user interface; the command contract lives in one place so tasks and reviews can check it mechanically.
- **Alternatives considered**: a docs/ split (overkill at scaffold scale — rejected); a minimal quickstart-only README (violates the constitution's topic list — rejected).
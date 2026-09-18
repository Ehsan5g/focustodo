---
description: "Task list for F001 Project Foundation & Tooling"
---

# Tasks: Project Foundation & Tooling (F001)

**Input**: Design documents from `/specs/001-project-foundation/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅ (12 decisions D1–D12), data-model.md ✅, contracts/ ✅ (commands, environment, ui-shell), quickstart.md ✅ (V1–V8)

**Tests**: Included — FR-005 and FR-006 explicitly require at least one passing sample test per layer (unit, component, E2E smoke).

**Organization**: Grouped by user story (US1 Reproducible Environment P1, US2 Quality Gates P1, US3 Data Layer P2, US4 UI Shell P2). Command spelling is contractual per `contracts/commands.md`; env contract per `contracts/environment.md`; shell behavior per `contracts/ui-shell.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Single full-stack Next.js project (plan.md): `src/` and `tests/` at repository root; Prisma in `prisma/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository bootstrap and approved-stack scaffold. The workspace currently contains only Spec Kit artifacts — this phase creates the repository.

- [x] T001 Initialize the git repository at repo root: create `.gitignore` FIRST (node_modules/, .next/, .env, coverage/, playwright-report/, test-results/, .DS_Store), run `git init`, create and switch to branch `001-project-foundation`, and make the initial commit of the existing Spec Kit artifacts
- [x] T002 Scaffold the Next.js 16 application at repo root with App Router, TypeScript strict mode, Tailwind CSS, and `src/` directory convention (npm as package manager — research.md D1; commit `package.json` and `package-lock.json`), keeping the scaffold's default `src/app/layout.tsx` and `src/app/page.tsx` as temporary starting points
- [x] T003 [P] Pin Node.js 22 LTS: create `.nvmrc` containing `22` and add `"engines": { "node": ">=22" }` to `package.json` (research.md D2)
- [x] T004 [P] Create `.editorconfig` at repo root with UTF-8, LF, 2-space indent, trimmed trailing whitespace, final newline

**Checkpoint**: Git repo exists on `001-project-foundation`; `npm install` and `npm run dev` work; scaffold renders.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuration substrate every user story builds on: strict typing, quality-tool configs, disposable database, fail-fast env, Prisma client.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Verify `tsconfig.json` has `"strict": true` (plus Next.js defaults: moduleResolution bundler, paths `@/*` → `./src/*`) and add the `"typecheck": "tsc --noEmit"` script to `package.json` (FR-003)
- [x] T006 [P] Create `eslint.config.mjs` as ESLint 9 flat config extending `eslint-config-next` with project rules `@typescript-eslint/no-explicit-any: "error"` and `no-console: "error"` (except config files), and add the `"lint": "next lint"` script (FR-004, D5)
- [x] T007 [P] Create `.prettierrc.json` (default style + `"plugins": ["prettier-plugin-tailwindcss"]`), install the plugin as devDependency, and add `"format:check": "prettier --check ."` and `"format": "prettier --write ."` scripts (FR-004, D5)
- [x] T008 [P] Create `docker-compose.yml` with a single `db` service: image `postgres:16-alpine`, named volume `focustodo_pgdata`, `pg_isready -U postgres` healthcheck, host port 5432, and `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` sourced from `.env` (research.md D9)
- [x] T009 [P] Create `.env.example` documenting `DATABASE_URL` (example `postgresql://postgres:postgres@localhost:5432/focustodo`) and nothing else — every listed variable must be real and validated (FR-012, contracts/environment.md)
- [x] T010 Create `src/lib/env.ts`: Zod schema validating `DATABASE_URL` (required, URL format) and `NODE_ENV` (optional enum development|production|test); parse at module load; on failure print ONE actionable message naming every problem (e.g. `Invalid environment configuration: - DATABASE_URL: required`) and exit the process — never a raw stack trace (FR-012, US1 scenario 3)
- [x] T011 Create `src/server/db.ts`: Prisma client singleton (global-cached in development to survive hot reload) importing the validated env from `src/lib/env.ts`; Prisma stays confined to `src/server/` (constitution III)
- [x] T012 [P] Create `src/lib/utils.ts` with the `cn()` class-merging helper and install its merge utility as devDependency (contracts/ui-shell.md)
- [x] T013 [P] Establish `src/app/globals.css` design tokens for light and dark themes (CSS variables keyed off the `<html>` `.dark` class) so Tailwind `dark:` variants work app-wide (contracts/ui-shell.md)

**Checkpoint**: Foundation ready — `npm run typecheck`, `npm run lint`, and `npm run format:check` pass on the scaffold; `docker compose up -d db` starts a healthy PostgreSQL; user story implementation can begin.

---


## Phase 3: User Story 1 — Reproducible Local Development Environment (Priority: P1) 🎯 MVP

**Goal**: A developer follows only the README from a fresh clone and reaches a running app backed by a running local database in ≤15 minutes with zero undocumented steps (SC-001).

**Independent Test**: Wipe workspace/volume/.env, follow README top-to-bottom verbatim, confirm the app is reachable and the database is running (quickstart V1).

### Implementation for User Story 1

- [x] T014 [US1] Add the documented npm scripts to `package.json` exactly as specified in `contracts/commands.md`: `dev`, `build`, `typecheck`, `lint`, `format:check`, `format`, `test`, `test:e2e`, `db:up` (`docker compose up -d db`), `db:migrate` (`prisma migrate dev`), `db:deploy` (`prisma migrate deploy`)
- [x] T015 [US1] Write `README.md` covering the constitution's mandated topics (product, features, tech stack, architecture, project structure orientation, environment variables, local development, database setup, tests, E2E tests, AI-assisted workflow, key architectural decisions) with every command copied verbatim from `contracts/commands.md`, prerequisites (Node 22 via `.nvmrc`, Docker Desktop), and troubleshooting for the three edge cases: port 3000/5432 in use, database unreachable (`docker compose start db` remedy), first E2E run (`npx playwright install chromium`) (FR-013)
- [x] T016 [US1] Validate US1 independently per quickstart V1 and V6: wipe `node_modules` + Docker volume + `.env`, follow the README top-to-bottom only (≤15 min, app reachable, db healthy), then remove `DATABASE_URL` from `.env` and confirm startup fails fast naming the variable with no stack trace; restore and confirm normal boot — ✅ V1 fresh-install path via README only; V6 fail-fast names DATABASE_URL; normal boot restored

**Checkpoint**: A fresh clone reaches a running environment following only the README — MVP usable.

---

## Phase 4: User Story 2 — Enforceable Quality-Gate Baseline (Priority: P1)

**Goal**: Every quality check runs via one documented command, passes on the untouched scaffold within SC-002 budgets, and fails pointing at the problem when a defect is introduced.

**Independent Test**: Run all gate commands on untouched code (all pass), then inject a type error, a lint violation, and a broken assertion and confirm each matching gate fails with the failing location (quickstart V2).

### Tests for User Story 2 (required by FR-005/FR-006 — write first, watch them fail)

- [x] T017 [P] [US2] Create `vitest.config.ts` (node environment default, jsdom available via per-file annotation) and `tests/setup.ts` with React Testing Library setup (auto-cleanup, jest-dom matchers), plus `"test": "vitest run"` and `"test:watch": "vitest"` scripts (FR-005, D6)
- [x] T018 [P] [US2] Create the shared-sample Zod schema `src/validation/theme-schema.ts` (enum `light|dark|system` — the theme preference contract from data-model.md) and its pure-logic unit test `tests/unit/theme-schema.test.ts` (valid values parse; invalid values rejected with issue path) proving the shared-schema pattern (constitution II)
- [x] T019 [P] [US2] Create `playwright.config.ts`: Chromium only, `baseURL http://localhost:3000`, `webServer` auto-starting `npm run dev` with `reuseExistingServer: true`, plus the `"test:e2e": "playwright test"` script (FR-006, D7)
- [x] T020 [US2] Create the smoke E2E test `tests/e2e/smoke.spec.ts`: load `/`, assert the app loads and the primary shell (header/main landmarks) is visible and operable (FR-006, US2 scenario 5)

### Implementation for User Story 2

- [x] T021 [US2] Create the component test `tests/component/theme-toggle.test.tsx`: render the theme toggle (from T028's component; stub if not yet built) and assert it renders accessibly (name, keyboard operability) — proves the component layer of the harness (FR-005)
- [x] T022 [US2] Validate US2 independently per quickstart V2: run `typecheck`, `lint`, `format:check`, `test`, `test:e2e` (after one-time `npx playwright install chromium`) on untouched code — all green within SC-002 budgets (<1 min typecheck/lint/unit+component, <5 min E2E steady state); then inject one type error, one lint violation, and one broken assertion, confirm each gate fails naming the file/line, and revert to green — ✅ all gates green (typecheck 3s, lint 5s, test 3s, e2e 2s, all well under SC-002); injected type/lint/assertion defects each caught naming file/line, then reverted

**Checkpoint**: Trustworthy enforcement baseline — every future change is measured against passing gates.

---

## Phase 5: User Story 3 — Working Data Layer (Priority: P2)

**Goal**: A brand-new empty database is created and brought to the current schema with documented commands, and a health verification proves a write-read round trip whose data survives full restarts (SC-005).

**Independent Test**: Delete the local database, recreate from documented commands, run schema management and the health verification, then restart app + database and confirm persistence (quickstart V3, V7).

### Implementation for User Story 3

- [x] T023 [US3] Create `prisma/schema.prisma` containing ONLY the datasource (postgresql, `env("DATABASE_URL")`) and generator (prisma-client-js) — zero models, migration history starts empty (data-model.md, D8); install Prisma as a dependency
- [x] T024 [US3] Validate the baseline per quickstart V3 recreate-from-zero: `docker compose down -v`, `npm run db:up`, `npm run db:deploy` — schema management applies to the brand-new empty database with zero errors and zero manual steps (FR-008, US3 scenarios 1–2) — ✅ down -v → db:up → db:deploy applied to brand-new empty DB
- [x] T025 [US3] Create the health verification `src/app/api/health/route.ts` (public GET Route Handler): ensure scratch table `health_check` exists via `CREATE TABLE IF NOT EXISTS` (table name is a code constant; values bound as parameters — constitution I), upsert singleton row id=1 incrementing `attempts` and setting `checked_at`, read it back, return 200 `{status:"ok", lastCheckedAt, attempts}`; on database failure return 503 with a remediation hint (how to start the db) and no internals (FR-009, D11)
- [x] T026 [US3] Validate US3 independently per quickstart V3 and V7: health call → 200 attempts=1, again → attempts=2; full app+db restart preserves the counter (real persistence); `docker compose stop db` then health call / `db:migrate` → clear "database unreachable" message with the remediation hint, no raw internal error; restart db → recovers (SC-005, US3 scenarios 3–4) — ✅ attempts 1→2; counter survives full app+db restart; stop db → 503 + remediation hint; db restart → recovers

**Checkpoint**: Persistence foundation proven end-to-end — features can build on the data layer.

---

## Phase 6: User Story 4 — Styled, Themeable, Accessible UI Shell (Priority: P2)

**Goal**: A placeholder landing view in a semantic shell with accessible base primitives, light/dark/system theming persisted across browser restarts, correct at 320/768/1280 px (SC-004, SC-006).

**Independent Test**: Open the placeholder page, toggle themes, resize across the three widths, navigate by keyboard (quickstart V4, V5).

### Implementation for User Story 4

- [x] T027 [P] [US4] Create accessible base UI primitives in `src/components/ui/` (button, card) following shadcn/ui conventions — semantic elements, keyboard operable, visible focus rings (FR-011, contracts/ui-shell.md)
- [x] T028 [P] [US4] Create the theme system in `src/components/theme/`: `ThemeProvider` (values light|dark|system, default system, persisted to `localStorage["focustodo-theme"]`, `useTheme()` exposing `{theme, setTheme}`) and the `ThemeToggle` client component; add the tiny pre-hydration inline script to `src/app/layout.tsx` applying the saved choice or `prefers-color-scheme` to the `<html>` class so there is no wrong-theme flash (FR-010, D4, SC-004)
- [x] T029 [US4] Build the placeholder shell in `src/app/layout.tsx` (semantic header/main landmarks, ThemeProvider wrap) and `src/app/page.tsx` (placeholder English content using the base primitives; explicitly not product copy), keeping client JS minimal — the theme toggle is the only client component (constitution III, FR-015)
- [x] T030 [US4] Validate US4 independently per quickstart V4 and V5: toggle dark → immediate update; full browser restart → dark restored; clear site data → system default; 320/768/1280 px → correct layout, no horizontal scrolling; keyboard-only tab → visible focus, all interactive elements reachable (US4 scenarios 1–4) — ✅ automated: no horizontal overflow at 320/768/1280; dark persists across fresh page (restart sim); clear storage → system; cycle + skip-link first-tabbable focus covered in smoke + component tests

**Checkpoint**: All user stories independently functional — proven styled, accessible starting point for feature UIs.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final compliance sweep and end-to-end validation of the whole foundation.

- [x] T031 Run the FR-014 sweep across `src/`, `tests/`, and config files: zero debug console statements, zero unnecessary TODO placeholders, `npm run format:check` green repo-wide — ✅ zero console./TODO/FIXME in src/ + tests/ (only "FocusTodo" substrings matched); format:check green
- [x] T032 Perform the SC-003 README command audit: execute every README command verbatim in a clean terminal and confirm 100% work as written (matches `contracts/commands.md`); re-measure SC-002 budgets and record the timings — ✅ every README command executed verbatim (dev, build, typecheck, lint, format:check, test, test:e2e, db:up, db:deploy, npx playwright install chromium); timings: typecheck 3s, lint 5s, test 3s, e2e 2s, build 7s
- [x] T033 Run the full quickstart.md V1–V8 validation as final acceptance, fix anything found, and commit the completed foundation on `001-project-foundation` — ✅ V1–V8 validated across story checkpoints + final acceptance commit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001 MUST precede all commits (`.gitignore` before any code); T002 depends on T001
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (README documents the real commands)
- **US2 (Phase 4)**: Depends on Phase 2; T021 depends on T017–T020 and partially on T028 (theme toggle) — if US4 runs later, stub the toggle for the component test, then T028 must keep it passing
- **US3 (Phase 5)**: Depends on Phase 2; T025 depends on T011 (db singleton) and T010 (env)
- **US4 (Phase 6)**: Depends on Phase 2 (tokens T013, utils T012); T029 depends on T027 + T028
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational — no dependency on other stories
- **US2 (P1)**: Starts after Foundational — independent of US1 (test:e2e's webServer starts the dev server itself)
- **US3 (P2)**: Starts after Foundational — independent of US1/US2
- **US4 (P2)**: Starts after Foundational — independent of US1/US2/US3 (T028 feeds T021's component test as noted)

### Parallel Opportunities

- Phase 2: T006, T007, T008, T009, T012, T013 all [P]
- Within stories: T017/T018/T019 [P]; T027/T028 [P]
- All four user stories can proceed in parallel after Phase 2 (single coupling point: the theme-toggle component test, resolved via stub-then-keep-green)

---

## Parallel Example: User Story 2

```bash
# Launch the three independent harness files together:
Task: "Create vitest.config.ts and tests/setup.ts"
Task: "Create src/validation/theme-schema.ts + tests/unit/theme-schema.test.ts"
Task: "Create playwright.config.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup → 2. Phase 2: Foundational → 3. Phase 3: US1
4. **STOP and VALIDATE** (quickstart V1/V6) — a fresh clone reaches a running environment

### Incremental Delivery

1. Setup + Foundational → substrate ready
2. US1 → reproducible environment (MVP!)
3. US2 → enforcement baseline (gates green + defect-fail verified)
4. US3 → proven persistence (restart-surviving round trip)
5. US4 → styled, accessible, themeable shell
6. Polish → FR-014 sweep, SC-003 audit, full V1–V8

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Command spellings are contractual (`contracts/commands.md`); the README must match them verbatim
- Commit after each task or logical group (repo initialized in T001)
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence


---

description: "Task list for feature implementation"
---

# Tasks: Comprehensive Test Suite (F008)

**Input**: Design documents from `/specs/008-testing-suite/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/suite-structure.md, contracts/ci-pipeline.md, quickstart.md

**Tests**: This feature IS the test suite — test tasks are the deliverables, explicitly requested by the spec (FR-001–FR-017). The constitution's "observe tests failing first" rule (Principle IV) is applied via the mutation/revert drills named in each story.

**Organization**: Tasks are grouped by user story in spec priority order (US1–US3 = P1, US4–US5 = P2, US6 = P3). Milestone mapping differs from phase numbering: US1→M2, US2→M5, US3→M4, US4→M3, US5→M6, US6→M6 (M1 = Setup + Foundational).

**Repo status note**: The repository is spec-only today. Per plan.md, the Phase 1–2 infrastructure lands with the first implemented feature (F001+) and every later feature's tests consolidate into the canonical `tests/` tree of contracts/suite-structure.md — no per-feature test sprawl. All paths below are exact and executable once the app tree exists.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Single Next.js project; consolidated test suite at repository root per plan.md Structure Decision: `tests/unit/`, `tests/component/`, `tests/e2e/`, `tests/helpers/`, plus root configs `vitest.config.ts`, `playwright.config.ts`, `.flaky.toml`, `.github/workflows/ci.yml`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Suite skeleton, test-only dependencies, browser tooling

- [ ] T001 [P] Scaffold the canonical `tests/` tree per contracts/suite-structure.md: `tests/unit/validation/`, `tests/unit/task-rules/`, `tests/unit/filtering/`, `tests/unit/categories/`, `tests/unit/authorization/`, `tests/unit/ux-decisions/`, `tests/component/`, `tests/e2e/journeys/`, `tests/e2e/responsive/`, `tests/e2e/resilience/`, `tests/e2e/security/`, `tests/e2e/fixtures/`, `tests/helpers/`
- [ ] T002 [P] Add test-only devDependencies to `package.json` (zero runtime dependencies; constitution-approved stack only): `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jest-axe`, `@playwright/test`; add scripts `test:unit`, `test:component`, `test:e2e`, `test` (all tiers in sequence) per contracts/suite-structure.md tier entry points
- [ ] T003 [P] Install Playwright Chromium (`npx playwright install chromium`) and add `test-results/`, `playwright-report/` to `.gitignore` (CI uploads artifacts on failure, then deletes traces — contracts/ci-pipeline.md)

**Checkpoint**: Skeleton, dependencies, and browser tooling in place

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Runners, persona/seed/time helpers, registries, CI — MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Create `vitest.config.ts` with two projects — `unit` (environment `node`, no DOM) and `component` (environment `jsdom`) — coverage provider `v8`, include globs matching the T001 tree; unit project must run with zero DOM APIs (research D1)
- [ ] T005 [P] Create `playwright.config.ts`: projects `desktop` 1280×720, `tablet` 768×1024, `mobile` 375×667; `webServer` starts the production Next.js build with `DATABASE_URL` pointed at `focustodo_test`; `fullyParallel: true`; `retries: 0` in CI (flaky-as-defect, research D7); tag-based matrix selection honoring `@critical` (research D6)
- [ ] T006 [P] Create `tests/helpers/time.ts` — `pinNow(date)`/`resetTime()` wrapping `vi.setSystemTime` for unit/component and a `page.clock.install()` helper for E2E; export so no test ever reads the real clock for assertions (research D3; FR-002, FR-017)
- [ ] T007 [P] Create `tests/helpers/persona.ts` implementing `FixturePersona` from data-model.md: roles `'owner' | 'second-user'` (exactly one of each per run), per-run `runId` unique suffix, email `persona.<role>.<runId>@test.local` (unique per user), password, `userId`; `tasks` seeds covering every status × priority × date bucket including midnight and year-end boundaries; 2 categories per persona with names shared across personas (proves per-user uniqueness); `createPersona(role, runId)`, `seedPersona()`, `cleanupPersona()` deleting by persona id, never truncating (FR-017, research D2/D4)
- [ ] T008 [P] Create `tests/helpers/rule-manifest.ts` + `testRule()` helper — `RuleManifestEntry { ruleId, ruleName, testIds, tier }` per data-model.md; `testRule('<rule-id>')` wraps `it` so every FR-001–FR-006 unit test's failure message names the rule (SC-001); export the full test-id list for the governance cross-check (SC-008)
- [ ] T009 [P] Add a `db-test` service to `docker-compose.yml` provisioning the `focustodo_test` PostgreSQL database; wire test env vars `DATABASE_URL` (→ `focustodo_test`) and `AUTH_SECRET` (test-only value; production secrets never used) per contracts/ci-pipeline.md Environment contract; migrations applied by test global setup
- [ ] T010 [P] Create `.flaky.toml` quarantine registry — schema per data-model.md QuarantineEntry: `[[entry]]` with `testId` (unique), `owner` (required), `reason`, `fixBy` (≤14 days out); start with zero entries
- [ ] T011 [P] Create `scripts/governance.mjs` — validates: (1) every `.flaky.toml` entry has owner + reason + `fixBy` not older than 14 days (overdue → fail); (2) every `tests/e2e/security/REGRESSIONS.md` entry maps to an existing permanent test; (3) every `rule-manifest.ts` `testId` exists in the suite (manifest-vs-suite diff); exits non-zero on any violation (research D8)
- [ ] T012 Create `.github/workflows/ci.yml` per contracts/ci-pipeline.md — PR-triggered jobs: `lint-typecheck` (~1 min, product AND test code) → `unit` (≤2 min) + `component` (≤3 min) in parallel → `e2e` (≤25 min, only after fast tiers pass); `governance` job running `scripts/governance.mjs`; `flaky-report` non-blocking job; all required status checks; wall-clock budget ≤30 min; Playwright `retries: 0`; install from lockfile only; upload Playwright traces on failure

**Checkpoint**: Runners, helpers, registries, and pipeline ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Unit Tests Guard the Business Rules (Priority: P1) 🎯 MVP

**Goal**: Every rule the product enforces (FR-001–FR-006) is pinned by a fast, focused unit test whose failure message names the broken rule (SC-001, SC-008; milestone M2).

**Independent Test**: Deliberately break each listed rule one at a time → a specific unit test fails naming the rule; restore → green (quickstart S1–S3). This story needs no browser, no E2E, no CI.

> The deliverables ARE tests (spec-requested). The fail-first drill is the mutation exercise below: for each suite, break the guarded rule and observe the named failure before declaring the suite done.

### Implementation for User Story 1

- [ ] T013 [P] [US1] Create `tests/unit/validation/validation.test.ts` — cover every validation schema and field limit as contractual rules (FR-001, quote verbatim): title of 1–120 characters; optional description up to 1000 characters; valid due dates; allowed status values (TODO, IN_PROGRESS, COMPLETED); allowed priority values (LOW, MEDIUM, HIGH); unique user emails; unique category names per user; tag every case `testRule('FR-001.<rule>')` so failures name the rule
- [ ] T014 [P] [US1] Create `tests/unit/task-rules/date-buckets.test.ts` — overdue, due today, upcoming with controlled time via `tests/helpers/time.ts`; identical results at 23:59 local, in a non-UTC timezone, at the midnight boundary and the year-end boundary (FR-002; US1.3; research D3)
- [ ] T015 [P] [US1] Create `tests/unit/filtering/filter-sort.test.ts` — every filter combination (status × priority × category × date bucket × search term) and every sort order returns the expected tasks (FR-003); seed via `tests/helpers/persona.ts`
- [ ] T016 [P] [US1] Create `tests/unit/categories/categories.test.ts` — creation, renaming, deletion of categories that still contain tasks, and task–category assignment and removal (FR-004); prove category-name uniqueness per user with two personas sharing category names
- [ ] T017 [P] [US1] Create `tests/unit/authorization/decisions.test.ts` — allow for the owner, deny for everyone else, for every read and write operation on tasks and categories (FR-005); assert denial results are generic (unit level of FR-014)
- [ ] T018 [P] [US1] Create `tests/unit/ux-decisions/ux.test.ts` — F007 client-side decisions: optimistic completion with rollback on rejection, theme persistence, double-submit prevention (FR-006)
- [ ] T019 [US1] Register every ruleId from FR-001–FR-006 with its testIds in `tests/helpers/rule-manifest.ts` (tiers `unit`); then run the mutation drill (quickstart S1/S2): break each rule once, confirm the named failure, restore to green; confirm `npm run test:unit` completes ≤2 min

**Checkpoint**: Rule guard pack green + mutation drill documented — any rule regression fails the suite with a rule-naming message

---

## Phase 4: User Story 2 — Authorization Is Proven, Not Assumed (Priority: P1)

**Goal**: Prove at every level that a user only sees and changes their own data — E2E denial matrix, generic leak-free responses, absent interface affordances, permanent security regressions (FR-013–FR-015, SC-003, SC-007; milestone M5 security half).

**Independent Test**: Attempt every read and write path as the second user against the owner's data at unit, component, and E2E level; verify denial, absent affordances, and leak-free responses (quickstart S4–S7).

### Implementation for User Story 2

- [ ] T020 [P] [US2] Create `tests/e2e/security/cross-user-denial.spec.ts` — as second user, attempt read, change, and delete of the owner's tasks and categories through every supported path, including directly constructed addresses; every attempt denied, nothing revealed (FR-013, SC-003; US2.1/2.2); uses `tests/helpers/persona.ts` owner + second-user fixtures
- [ ] T021 [P] [US2] Create `tests/e2e/security/generic-denials.spec.ts` — capture every denial response from T020 paths and assert it is generic: reveals nothing about existence, ownership, or content of other users' data (FR-014; US2.3)
- [ ] T022 [P] [US2] Create `tests/component/unauthorized-affordances.test.tsx` — render second-user views and verify no actions on the owner's data are offered or reachable in the DOM (FR-013 component level)
- [ ] T023 [US2] Create `tests/e2e/security/REGRESSIONS.md` with the SecurityRegressionEntry schema from data-model.md (`fixId`, `summary`, `testIds`, `landedIn`); append one entry per previously identified vulnerability/security fix, each mapped to a permanent test that stays in the suite (FR-015, SC-007; entries never deleted)

**Checkpoint**: Cross-user denial 100% at all three levels; leak-free responses asserted; regression pack established

---

## Phase 5: User Story 3 — End-to-End Journeys Prove the Product Works (Priority: P1)

**Goal**: The journeys a real user walks run as automated E2E tests: full account/task/category/dashboard journeys, the 3×2 device×theme matrix for key journeys, resilience (slow network, forced failures, rollback), and theme persistence (FR-009–FR-012, SC-002; milestone M4).

**Independent Test**: Run the E2E suite against the seeded environment; every journey passes across the three device classes, degraded networks, injected failures, and both themes (quickstart S8–S11).

### Implementation for User Story 3

- [ ] T024 [P] [US3] Create `tests/e2e/journeys/auth.spec.ts` — registration → login → logout through the product's own registration path (fixture personas), seeded environment only (FR-009)
- [ ] T025 [P] [US3] Create `tests/e2e/journeys/task-crud.spec.ts` — `@critical` create, edit, complete, search, filter, delete a task; runs the full 3×2 matrix per research D6 (FR-009; SC-002)
- [ ] T026 [P] [US3] Create `tests/e2e/journeys/categories-dashboard.spec.ts` — `@critical` create, rename, delete a category and view the dashboard; full 3×2 matrix (FR-009)
- [ ] T027 [P] [US3] Create `tests/e2e/responsive/matrix.spec.ts` — every `@critical` journey passes at Desktop 1280×720, Tablet 768×1024, Mobile 375×667 in light and dark themes (FR-010; SC-002)
- [ ] T028 [P] [US3] Create `tests/e2e/responsive/no-horizontal-scroll.spec.ts` — `document.scrollingElement.scrollWidth <= clientWidth` at 360/768/1280 px widths with F007 stress fixtures: 120-character title, 1000-character description (FR-010; F007 SC-007)
- [ ] T029 [P] [US3] Create `tests/e2e/resilience/slow-network.spec.ts` — throttled network: skeletons appear, no double submits (FR-011)
- [ ] T030 [P] [US3] Create `tests/e2e/resilience/forced-failures.spec.ts` — forced save and deletion failures: friendly error shown, input preserved (FR-011)
- [ ] T031 [P] [US3] Create `tests/e2e/resilience/optimistic-rollback.spec.ts` — forced completion-toggle rejection rolls the UI back to exactly the server's state (FR-011)
- [ ] T032 [P] [US3] Create `tests/e2e/responsive/theme.spec.ts` — theme persists across reload via the pre-paint class probe (`localStorage["focustodo-theme"]` per F007 contract), system-preference default on first visit, and a key journey passing in both themes (FR-012; SC-006)

**Checkpoint**: All critical journeys green across the full matrix; resilience and theme contracts proven on the seeded environment

---

## Phase 6: User Story 4 — Components Are Verified in Isolation (Priority: P2)

**Goal**: Each core UI piece renders alone with controlled inputs and proves its states, transitions, keyboard operation, and assistive announcements (FR-007, FR-008, SC-006; milestone M3).

**Independent Test**: Render each component in isolation; verify loading/empty/error/success/busy behavior, keyboard traversal with visible focus, and polite announcements; axe passes in both themes (quickstart S12–S14).

### Implementation for User Story 4

> One suite per FR-007 core piece (contracts/suite-structure.md). Each suite asserts every specified state and transition, ends with a `jest-axe` pass in light AND dark theme contexts, and verifies keyboard operability + visible focus + announcements (toast `aria-live="polite"`, form errors bound via `aria-describedby` + `role="alert"`, busy triggers `aria-busy`).

- [ ] T033 [P] [US4] Create `tests/component/task-form.test.tsx` — every specified state/transition of the task form (FR-007) + keyboard/axe requirements above (FR-008)
- [ ] T034 [P] [US4] Create `tests/component/task-item.test.tsx` — task list item states and transitions (FR-007/FR-008)
- [ ] T035 [P] [US4] Create `tests/component/filters.test.tsx` — filter states and transitions (FR-007/FR-008)
- [ ] T036 [P] [US4] Create `tests/component/empty-states.test.tsx` — empty-state rendering and transitions (FR-007/FR-008)
- [ ] T037 [P] [US4] Create `tests/component/dashboard-cards.test.tsx` — dashboard card states (FR-007/FR-008)
- [ ] T038 [P] [US4] Create `tests/component/skeleton.test.tsx` — skeleton loading behavior (FR-007/FR-008)
- [ ] T039 [P] [US4] Create `tests/component/error-message.test.tsx` — error message states, field association (FR-007/FR-008)
- [ ] T040 [P] [US4] Create `tests/component/toast.test.tsx` — toast announcements: polite, never focus-stealing, meaning matches visible text (FR-008)
- [ ] T041 [P] [US4] Create `tests/component/modal-sheet.test.tsx` — modal/bottom-sheet container states and transitions (FR-007/FR-008)
- [ ] T042 [US4] Cross-suite verification: run axe in both themes for every `tests/component/*.test.tsx` with zero violations, walk the full suite keyboard-only with visible focus, and confirm every FR-007 core piece has a suite (SC-006; quickstart S12–S14; depends on T033–T041)

**Checkpoint**: Nine core suites green with state, keyboard, and a11y proof in both themes

---

## Phase 7: User Story 5 — The Suite Runs Itself and Blocks Bad Changes (Priority: P2)

**Goal**: The pipeline runs automatically on every proposed change, enforces the 5/30-minute budgets, blocks merging when red, and quarantines flaky tests with an owner and fix date — never skipping or retrying them silently (FR-016, SC-004, SC-005; milestone M6; research D7/D8).

**Independent Test**: Submit a change that breaks a rule → the suite runs automatically, fails, blocks the merge, and names the failure; an intermittently failing test is quarantined with an owner rather than skipped (quickstart S15–S19).

### Implementation for User Story 5

- [ ] T043 [US5] Add per-job budget enforcement to `.github/workflows/ci.yml` — caps per contracts/ci-pipeline.md (unit ≤2 min, component ≤3 min, fast combined ≤5 min, e2e ≤25 min, total ≤30 min); a job that exceeds its cap fails (Edge Case: suite grows slower — no silent creep); per-job duration reported (FR-016, SC-004)
- [ ] T044 [US5] Implement the `flaky-report` job in `.github/workflows/ci.yml` — runs quarantined tests listed in `.flaky.toml` as a separate non-blocking report; never silently skipped, never retried until green (`retries: 0`); report can never turn the pipeline green (US5.3; research D8)
- [ ] T045 [US5] Governance verification drills against `scripts/governance.mjs`: delete a mapped test without replacement → governance fails (SC-008); add a `.flaky.toml` entry with missing owner or a `fixBy` older than 14 days → governance fails; break a rule → CI output names the rule and journey (SC-001; quickstart S17/S18); depends on T012, T019
- [ ] T046 [US5] Red-blocks-merge proof using `.github/workflows/ci.yml` + repo branch protection: open a draft PR with a deliberately broken rule → pipeline runs automatically, goes red, merge is blocked; then a green PR merges (SC-005; quickstart S16; depends on T012, T019, T043)

**Checkpoint**: Budgets enforced, quarantine policy live, governance enforcing all three registries, red reliably blocks merge

---

## Phase 8: User Story 6 — Every Fixed Bug Stays Fixed (Priority: P3)

**Goal**: A repeatable bug-fix ritual (failing test first, then fix) and permanent proof that reverting any fix fails a named test (SC-007; milestone M6).

**Independent Test**: Take any fixed bug, revert its fix → a named test fails; restore the fix → green (quickstart S21/S22).

### Implementation for User Story 6

- [ ] T047 [US6] Run the bug-fix ritual end to end (quickstart S21/S22): take one fixed bug, write its failing test first in the matching pack (`tests/unit/…` or the owning `tests/e2e/journeys/*.spec.ts`), observe it fail, apply the fix, observe green; the test becomes permanent; journey regressions are added to the owning journey spec (US6.1–US6.3; depends on T019, T023)
- [ ] T048 [US6] SC-007 proof: revert one fix listed in `tests/e2e/security/REGRESSIONS.md` → its named regression test fails; restore → green; confirm entries are never deleted and new fixes require a same-PR entry (FR-015; depends on T023, T047)

**Checkpoint**: Regression discipline demonstrably permanent — reverting any fix fails the suite

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full-suite validation, and isolation proof across all stories

- [ ] T049 [P] Update `README.md` test sections (constitution README requirement): test commands and tiers, budgets (≤5 fast / ≤30 full), seeded test environment setup (`db-test`, `focustodo_test`), persona fixtures, quarantine policy, governance job
- [ ] T050 Run the full validation in `specs/008-testing-suite/quickstart.md` (S1–S22) and record results (all stories; Definition of validated)
- [ ] T051 Budget run: execute `npm run test` and record per-tier durations against the caps — fast ≤5 min, full ≤30 min (SC-004; quickstart S15; depends on T013–T041)
- [ ] T052 Isolation proof via `vitest.config.ts` + `playwright.config.ts` (or `package.json` scripts): run the suite with shuffled order and 2× parallelism — green; two workers never share persona rows (FR-017; quickstart S20; depends on T013–T041)

**Checkpoint**: Suite validated against its own guarantees; documentation current

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (T012 CI also consumes T011 governance script and T010 registry)
- **User Stories (Phases 3–8)**: All depend on Foundational completion; P1 stories first (US1 → US2 → US3), then P2 (US4, US5), then P3 (US6)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1, MVP)**: Foundational only — fully independent (no browser, no E2E, no CI needed)
- **US2 (P1)**: Foundational only; its unit level reuses FR-005 decisions from T017 but is independently testable
- **US3 (P1)**: Foundational only; journeys are seeded per persona, independent of other stories
- **US4 (P2)**: Foundational only; may proceed in parallel with US1–US3
- **US5 (P2)**: Foundational + needs at least the US1 pack to exist for meaningful drills (T045, T046 depend on T019)
- **US6 (P3)**: Depends on US2 (T023 REGRESSIONS.md entries) and a completed fix to ritualize (T047 after T019/T023)

### Within Each User Story

- Helpers/configs first (Foundational), then suites (one file per task, all `[P]` within a story), then the story's verification/registration task
- Each suite: write tests → run the story's fail-first drill (mutation for US1, revert for US6, denial probe for US2) → observe named failure → restore → green
- Story checkpoint met before moving to the next priority

### Parallel Opportunities

- Phase 1: T001, T002, T003 all in parallel
- Phase 2: T004–T011 all in parallel (different files); T012 after T010/T011
- Within US1: T013–T018 all in parallel (six independent family files)
- Within US2: T020–T022 in parallel; T023 after
- Within US3: T024–T032 all in parallel (nine independent spec files)
- Within US4: T033–T041 all in parallel (nine independent suites); T042 after
- Across stories: US1–US4 can be worked simultaneously once Foundational lands

---

## Parallel Example: User Story 1

```bash
# Launch all six rule-family suites together (different files, no dependencies):
Task: "tests/unit/validation/validation.test.ts (FR-001)"
Task: "tests/unit/task-rules/date-buckets.test.ts (FR-002)"
Task: "tests/unit/filtering/filter-sort.test.ts (FR-003)"
Task: "tests/unit/categories/categories.test.ts (FR-004)"
Task: "tests/unit/authorization/decisions.test.ts (FR-005)"
Task: "tests/unit/ux-decisions/ux.test.ts (FR-006)"

# Then, sequentially: T019 manifest registration + mutation drill
```

## Parallel Example: User Story 3

```bash
# Launch all nine E2E specs together (independent files, shared helpers already exist):
Task: "tests/e2e/journeys/auth.spec.ts"
Task: "tests/e2e/journeys/task-crud.spec.ts"
Task: "tests/e2e/journeys/categories-dashboard.spec.ts"
Task: "tests/e2e/responsive/matrix.spec.ts"
Task: "tests/e2e/responsive/no-horizontal-scroll.spec.ts"
Task: "tests/e2e/resilience/slow-network.spec.ts"
Task: "tests/e2e/resilience/forced-failures.spec.ts"
Task: "tests/e2e/resilience/optimistic-rollback.spec.ts"
Task: "tests/e2e/responsive/theme.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 unit rule pack + T019 mutation drill
4. **STOP and VALIDATE**: quickstart S1–S3 (break each rule → named failure → restore → green)
5. The rule guard alone already enforces SC-001 and seeds SC-008

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US1 → mutation drill → rule protection live (MVP)
3. US2 → denial matrix + regression pack → security gate (SC-003 seed)
4. US3 → journeys + matrix + resilience → product-level proof (SC-002)
5. US4 → component/a11y pack (SC-006)
6. US5 → budgets, quarantine, red-blocks-merge (SC-004/SC-005)
7. US6 → regression ritual (SC-007)
8. Polish → quickstart S1–S22 full validation

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (unit rule pack)
   - Developer B: US2 (security pack)
   - Developer C: US3 (journeys)
3. Then: Developer A: US4 · Developer B: US5 · Developer C: US6

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to spec user story for traceability (US1–US6)
- Tests verify behavior, not implementation: query by accessible role/name, never internal structure or timing luck (spec Constraint)
- Every failure message names the broken rule/journey (SC-001); `testRule()` tags enforce it
- Quarantined tests: non-blocking report only, owner + fix-by ≤14 days, zero retries (US5.3)
- When the suite is red, fixing it takes priority over new feature work; authorization failures take priority over everything (spec Assumptions)
- Stop at any checkpoint to validate a story independently; commit after each task or logical group

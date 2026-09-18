# Implementation Plan: Comprehensive Test Suite (F008)

**Branch**: `008-testing-suite` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-testing-suite/spec.md`

## Summary

Consolidate the per-feature test gates defined across F001–F007 into one
continuously-run, constitution-enforcing suite: unit tests pin every business rule
(validation schemas, status/priority values, date logic, filtering/sorting, category
rules, authorization decisions, F007 UX decisions), component tests verify each core
UI piece in isolation including keyboard/screen-reader behavior, and Playwright E2E
runs the critical journeys across desktop/tablet/mobile in both themes with
resilience (slow network, forced failures, optimistic rollback) and the permanent
security scenario. The suite seeds and cleans its own data with fixture personas,
controls time deterministically, runs automatically on every proposed change within
the 5-minute (fast tiers) / 30-minute (full) budgets, blocks merging when red,
quarantines flaky tests with an owner and fix date, and guards
coverage-never-decreases via a rule→test manifest. No new product entities, no new
runtime libraries — test-only devDependencies within the constitution-approved stack
(Vitest, React Testing Library, Playwright).

## Technical Context

**Language/Version**: TypeScript (strict mode) on Node.js 22 LTS — same compiler
settings as product code; test code follows the same review and quality standards
(spec Assumptions §Standards).

**Primary Dependencies**: Product stack under test: Next.js 16 (App Router), React,
Prisma, PostgreSQL, Auth.js, Zod, Tailwind. Test stack (constitution-approved):
Vitest (unit + component, jsdom DOM), React Testing Library (+ user-event,
jest-dom matchers, jest-axe for automated a11y/contrast checks), Playwright
(E2E, multi-viewport). No new runtime libraries (spec Constraint; FR-017 tests
never depend on external service availability).

**Storage**: PostgreSQL test database provisioned by the existing Docker Compose
setup (separate `focustodo_test` database; migrations applied by global setup;
every test seeds and cleans up its own data — FR-017).

**Testing**: This feature IS the testing layer. Tiers: `npm run test:unit` (Vitest),
`npm run test:component` (Vitest + RTL), `npm run test:e2e` (Playwright),
`npm run test` (all tiers in sequence). Tests verify behavior, not implementation
(spec Constraint).

**Target Platform**: Developer machines and CI (Linux runners); E2E browsers:
Chromium in CI (single engine, constitution-fixed stack; other engines optional
locally), viewports Desktop 1280×720 / Tablet 768×1024 / Mobile 375×667.

**Project Type**: Web application (Next.js) with a consolidated test suite at
repository root. Repo is currently spec-only (F001–F009 planned ahead of a
consolidated build): F008 defines the canonical suite structure and gates now; the
infrastructure (M1) lands with the first implemented feature and every later
feature's tests consolidate into it.

**Performance Goals**: Fast tiers (unit + component) complete in under 5 minutes;
full suite including E2E completes in under 30 minutes (SC-004); suite slowdown is
monitored so budgets do not creep (Edge Case: suite grows slower).

**Constraints**: Red suite blocks merging 100% of the time (SC-005); flaky tests
quarantined with owner + fix date, never silently skipped or retried-until-green;
failure messages name the broken rule (SC-001); 100% cross-user denial with zero
data leakage (SC-003); coverage of enumerated rules and critical journeys never
decreases (SC-008); parallel and order-independent execution (FR-017).

**Scale/Scope**: ~200–300 unit tests across ~8 rule families, ~10 core component
suites, ~12 E2E journey specs × up to 6 matrix variants (3 devices × 2 themes for
key journeys, sampled elsewhere — Edge Case: matrix multiplication); 2 fixture
personas per run; 1 CI pipeline with tiered jobs.


## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Server-Authoritative Security | ✅ PASS | FR-005/FR-013/FR-014/FR-015 test authorization at every level; security E2E is a permanent gate; fixture personas prove isolation; denial responses asserted generic. The suite adds no server surface — it only exercises the five-step contract as-is. |
| II. Type Safety & Strict Validation | ✅ PASS | Test code is TypeScript strict, no `any`; tests treat Zod schemas and field limits (title 1–120, description ≤1000, status/priority enums, unique email, unique category per user) as contractual rules with per-rule failure messages (FR-001). |
| III. Modular Architecture & Simplicity | ✅ PASS | Suite mirrors the modular architecture (unit tests colocated per rule family; component tests per component; E2E per journey). No new abstractions; test-only devDependencies limited to the constitution-approved Vitest/RTL/Playwright. Complexity Tracking: none. |
| IV. Test-First Quality Gates | ✅ PASS | This feature is the constitution's gate made concrete: every enumerated rule has a named test (SC-001), every bug fix starts from a failing test (US6/SC-007), red blocks merge (SC-005), behavior-not-implementation enforced (spec Constraint). |
| V. Production UX, Accessibility & Performance | ✅ PASS | Component tests assert keyboard operability, visible focus, polite non-focus-stealing announcements, form errors bound to fields, and axe-based AA contrast in both themes (FR-008, SC-006); E2E verifies responsive contracts and both themes (FR-010/FR-012); optimistic rollback verified to server truth (FR-011). |

## Project Structure

### Documentation (this feature)

```text
specs/008-testing-suite/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── suite-structure.md
│   └── ci-pipeline.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Test suite consolidates with the future app tree (F001–F007 surfaces under test);
# test code lives alongside product code under the same standards (spec Assumptions).
tests/
├── unit/                      # Vitest — pure logic, no DOM
│   ├── validation/            # Zod schemas + field limits (FR-001)
│   ├── task-rules/            # status/priority, date logic (overdue/due-today/upcoming)
│   ├── filtering/             # filter combinations + sort orders (FR-003)
│   ├── categories/            # create/rename/delete-with-tasks/assignment (FR-004)
│   ├── authorization/         # ownership decision logic (FR-005)
│   └── ux-decisions/          # optimistic rollback, theme persistence, double-submit (FR-006)
├── component/                 # Vitest + RTL — one suite per core piece (FR-007)
│   ├── task-form/ ├── task-item/ ├── filters/ ├── dashboard-cards/
│   ├── skeleton/ ├── empty-state/ ├── error-message/ ├── toast/
│   └── dialog-container/      # modal/bottom-sheet behaviors
├── e2e/                       # Playwright — journeys, resilience, security
│   ├── journeys/              # auth, task CRUD+toggle, search/filter, categories, dashboard (FR-009)
│   ├── responsive/            # device classes × themes (FR-010, FR-012)
│   ├── resilience/            # slow network, forced failures, rollback (FR-011)
│   ├── security/              # cross-user denial + leakage + regression pack (FR-013–FR-015)
│   └── fixtures/              # persona seeding, environment bootstrap
└── helpers/                   # shared: time control, seed/cleanup, rule→test manifest
    └── rule-manifest.ts       # SC-008 coverage-never-decreases manifest

playwright.config.ts            # projects: desktop/tablet/mobile; webServer; retries=0 in CI
vitest.config.ts                # unit + component projects, jsdom, coverage
.flaky.toml                     # quarantine registry: test id, owner, fix date
.github/workflows/ci.yml        # tiered jobs: lint+typecheck → fast tiers → e2e (PR-blocking)
```

**Structure Decision**: Single Next.js project with a root-level `tests/` tree
mirroring the three tiers; test-infrastructure files at repository root. The repo is
spec-only today, so this layout is the canonical contract: when the app builds
(F001+), suites attach exactly as laid out here — no per-feature test sprawl, and
every later feature's tests consolidate into this tree. Test-only devDependencies
(vitest, @vitest/coverage-v8, jsdom, @testing-library/react, @testing-library/dom,
@testing-library/user-event, @testing-library/jest-dom, jest-axe, @playwright/test)
are justified by the constitution-approved testing stack; zero runtime dependencies
are added.

## Milestones

1. **M1 — Suite infrastructure**: Vitest/RTL/Playwright configs, test DB via the
   existing Docker Compose (`focustodo_test`), seed/cleanup helpers, deterministic
   time control, CI pipeline with tiered blocking jobs.
2. **M2 — Unit rule pack**: all rule families (FR-001–FR-006) with rule-naming
   failure messages; rule→test manifest established (SC-001, SC-008).
3. **M3 — Component pack**: 10 core suites incl. keyboard, focus, announcements,
   axe contrast in both themes (FR-007/FR-008, SC-006).
4. **M4 — E2E journey pack**: critical journeys + responsive matrix + theme
   persistence, full matrix for key journeys (FR-009/FR-010/FR-012, SC-002).
5. **M5 — Resilience & security pack**: slow network, forced failures with preserved
   input, optimistic rollback to server truth, cross-user denial matrix, generic-
   response assertions, regression pack for every prior fix (FR-011, FR-013–015).
6. **M6 — Process gates**: quarantine registry + policy, budget monitoring
   (≤5/≤30 min), coverage guard wired into CI, red-blocks-merge verified end to end
   (SC-004/SC-005/SC-007/SC-008).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | — | — |

## Post-Design Constitution Re-Check

**Result: PASS (5/5).** The design adds no server surface (the five-step contract is
exercised verbatim, never modified), no product entities, and no non-approved
dependencies; it directly implements the Principle IV gates and the Principle V
accessibility/responsive verifications. The only structural additions — the rule→test
manifest and the quarantine registry — are plain data files that enforce SC-005 and
SC-008 and are the simplest mechanism that satisfies them (Principle III holds).

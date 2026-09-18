# Quickstart: Comprehensive Test Suite (F008)

**Feature**: `008-testing-suite` | **Date**: 2026-09-18
**Purpose**: runnable validation that the suite itself delivers its guarantees.
References: [contracts/suite-structure.md](./contracts/suite-structure.md) (layout,
naming, personas), [contracts/ci-pipeline.md](./contracts/ci-pipeline.md) (pipeline,
gates), [data-model.md](./data-model.md) (registries), plan.md milestones M1–M6.

## Prerequisites

- Product code from F001–F007 implemented (repo currently spec-only: M1 lands with
  the first implemented feature; scenarios below are the acceptance rehearsal).
- Docker Compose running with the `db-test` service; `DATABASE_URL` points at
  `focustodo_test`; migrations applied by test global setup.
- Playwright browsers installed (`npx playwright install chromium`).

## Commands

```bash
npm run test:unit        # ≤2 min
npm run test:component   # ≤3 min
npm run test:e2e         # ≤25 min (starts production server + seeded DB)
npm run test             # all tiers; ≤30 min total
```

## A. Rule guard drill (US1, SC-001, SC-008) → M2

- **S1 Mutate a rule**: change the title-length limit (e.g., 120→200) in the Zod
  schema → `npm run test:unit` fails and the failure message names the rule
  ("rejects a task title longer than 120 characters"); restore → green.
- **S2 Exhaustive coverage**: `governance` job shows every FR-001–FR-006 rule id
  green in the rule manifest; deleting a mapped test without replacement fails
  governance (SC-008).
- **S3 Deterministic dates**: run the date-rule tests at 23:59 local time and in a
  non-UTC timezone → identical results (pinned clock; midnight & year-end boundary
  cases pass) (US1.3).

## B. Authorization proof (US2, SC-003) → M5

- **S4 Denial matrix**: as second user, attempt every read/update/delete path
  (UI actions, direct task/category URLs, crafted action calls) against owner data
  → all denied; suite asserts zero data leakage (US2.1, FR-013).
- **S5 Interface hiding**: component tests render second-user views → no action
  affordances on owner data exist in the DOM (FR-013 component level).
- **S6 Generic denials**: captured denial responses (unit + E2E) contain no hint of
  existence/ownership/content of other users' data (FR-014).
- **S7 Permanent regression pack**: revert any past security fix → its named
  regression test fails; restore → green; entries never leave `REGRESSIONS.md`
  (FR-015, SC-007).

## C. Journey & matrix proof (US3, SC-002) → M4

- **S8 Critical journeys full matrix**: run `npm run test:e2e` → every `@critical`
  journey passes at Desktop/Tablet/Mobile in light and dark (3×2), seeded env only
  (FR-009, FR-010).
- **S9 Resilience replay**: forced slow network (skeletons, no double submits),
  forced save/delete failures (friendly error, preserved input), forced toggle
  rejection (UI rolls back to exactly server state) all pass (FR-011).
- **S10 Theme no-flash**: reload journey asserts pre-paint theme class in both
  themes and persistence across reload (FR-012, SC-006).
- **S11 No horizontal scroll**: 360/768/1280 px checks pass with 120-char title and
  1000-char description fixtures (F007 SC-007).

## D. Component & a11y proof (US4, SC-006) → M3

- **S12 State walk**: render each core component in isolation → loading, empty,
  error, success, busy states each behave and communicate per its feature spec
  (FR-007).
- **S13 Keyboard walk**: keyboard-only traversal reaches and operates every
  interactive element with visible focus (FR-008).
- **S14 Announcements**: toast/errors/status changes produce polite,
  non-focus-stealing announcements matching visible meaning; axe passes in both
  themes with zero violations (FR-008, SC-006).

## E. Automation & process drills (US5, SC-004/SC-005) → M1, M6

- **S15 Budget check**: run `npm run test` locally and the CI pipeline on a PR →
  fast tiers ≤5 min, full suite ≤30 min; job duration report visible.
- **S16 Red blocks merge**: submit a PR that breaks a rule → pipeline runs
  automatically, fails, merge is blocked (SC-005); green PR merges.
- **S17 Failure legibility**: deliberately broken rule's CI output names the rule
  and the journey (behavior-sentence titles) (SC-001).
- **S18 Quarantine drill**: mark a test flaky with owner + fix-by → it moves to the
  non-blocking report job (pipeline stays green), governance tracks it; a fix-by
  older than 14 days or missing owner fails governance (US5.3, D8).
- **S19 No-retry proof**: force intermittent failure with `retries: 0` → job goes
  red immediately; no retry masking in logs (spec Edge Case).
- **S20 Isolation proof**: run the suite with shuffled order and 2× parallelism →
  green; two workers never share persona rows (FR-017, D2).

## F. Regression discipline (US6, SC-007) → M6

- **S21 Bug-fix ritual**: confirm a bug → write failing test reproducing it → fix →
  test green and permanent; reverting the fix fails the named test (US6.1/6.2).
- **S22 Journey regression**: a bug fix inside a critical journey adds the scenario
  to that journey's E2E spec (US6.3).

## Definition of validated

S1–S22 green + budgets honored + governance job enforcing all three registries +
`typecheck`/`lint` clean = F007-style DoD satisfied for the suite itself
(Principle IV: the suite that enforces "a feature is not done until its tests exist
and pass" must itself demonstrably pass its own gates).

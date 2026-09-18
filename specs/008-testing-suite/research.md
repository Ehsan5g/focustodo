# Research: Comprehensive Test Suite (F008)

**Feature**: `008-testing-suite` | **Date**: 2026-09-18
**Method**: constitution-fixed stack (Vitest, React Testing Library, Playwright);
decisions resolve every planning question the spec leaves open. Product entities and
behaviors under test come verbatim from F002–F007; no product code changes.

## D1 — Suite architecture, entry points, and environment split

**Decision**: Three Vitest "projects" (unit, component) plus one Playwright
project set, wired as four npm scripts: `test:unit`, `test:component`, `test:e2e`,
`test` (all tiers sequentially). Unit tests run in a Node environment with no DOM;
component tests run in jsdom with React Testing Library; E2E runs Playwright against
a Next.js server started by `webServer` (production build) pointed at the
`focustodo_test` PostgreSQL database from the existing Docker Compose.

**Rationale**: The constitution fixes the frameworks; the only real choice is
environment split. One Vitest config with projects keeps a single runner and shared
config while letting unit tests skip the DOM (faster, stricter). jsdom is the
default RTL target (RTL docs assume it) and supports axe via jsdom. Playwright's
`webServer` manages server lifecycle, so no bespoke orchestration. Separate scripts
map 1:1 onto the spec's tiers and the CI budget split (5-min fast tiers vs 30-min
full suite, SC-004/FR-016).

**Alternatives considered**:
- *Happy-dom instead of jsdom* — faster, but jsdom has better axe/RTL compatibility;
  speed difference is irrelevant at our scale. Rejected.
- *Single Vitest config without projects* — loses per-tier timeout/coverage tuning
  and blurs the CI budget boundary. Rejected.
- *Playwright component testing instead of RTL* — duplicates the constitution's
  chosen component tool and drags browser startup into the fast tier. Rejected.

## D2 — Test database, seeding, and per-test isolation

**Decision**: Dedicated `focustodo_test` database (Docker Compose addition);
Prisma migrations applied by Vitest/Playwright global setup. Isolation strategy:
each test file creates its own fixture personas with unique suffixes (seeded from a
per-run random + worker id), every test seeds exactly the rows it needs and cleans
them in `afterEach`; E2E specs additionally run Playwright workers with
`fullyParallel` and per-worker personas so two workers never share rows. Cleanup
deletes by persona id, never truncates shared tables mid-run.

**Rationale**: FR-017 requires self-seeding/cleanup, any-order and parallel
execution without cross-test interference (spec Edge Case). Unique-suffix personas
make collisions impossible without heavyweight schema-per-worker machinery; scoped
cleanup keeps parallel workers independent. Global-setup migrations guarantee the
schema exists before any tier runs.

**Alternatives considered**:
- *Transaction-per-test rollback* — fastest cleanup but breaks tests that exercise
  commit-boundary behavior (registration, optimistic toggle confirmations) and
  cannot be shared across the E2E process boundary. Rejected as the sole strategy;
  retained as an optional fast path inside unit suites where safe.
- *Schema-per-worker* — heavier, complicates migrations for marginal benefit at
  current scale (2 personas/run). Rejected (YAGNI, Principle III).
- *Snapshot-restore database images* — slow and fragile in CI. Rejected.

## D3 — Deterministic time control

**Decision**: Unit/component: `vi.useFakeTimers()` + `vi.setSystemTime()` (Vitest
native). E2E: Playwright's clock API (`page.clock.install()`) to pin the browser
clock; all due-date fixtures created relative to the pinned "now". Overdue /
due-today / upcoming rules are verified across midnight boundaries and year end
(spec Edge Case) by parameterized boundary cases: `now-1s`, `now`, `now+1s`,
`23:59:59 → 00:00:00` crossing, and `Dec 31 → Jan 1` crossing, in UTC and one
non-UTC timezone for the server-side date logic.

**Rationale**: Spec US1.3 requires identical results "at any time of day or in any
timezone" — only controlled time delivers that. Vitest fake timers and Playwright
clock are built into the approved stack; boundary enumeration turns the rule into
concrete, always-green cases.

**Alternatives considered**:
- *Mocking date library* (e.g., sinon fake timers / mockdate) — redundant with
  Vitest/Playwright built-ins; extra test-only dependency. Rejected.
- *Waiting for real date rollovers* — impossible/unbounded. Rejected.

## D4 — Fixture personas and seeded datasets

**Decision**: A typed `FixturePersona` factory (helpers) creates: **owner** and
**second user**, each with a stable shape — unique email (`persona+<runid>@test`),
password hash via the product's own registration flow for E2E (real journey) and
direct seeding for unit/component/perf (fast), plus per-persona tasks (covering
every status/priority/date bucket) and categories (2, one shared-name across
personas to prove per-user uniqueness). Personas are created fresh per run, never
reused across runs, and never share rows (spec Edge Case: fixtures would mix users'
data). Task titles include stress strings (120-char title, 1000-char description,
emoji) for responsive E2E (F007 SC-007).

**Rationale**: The spec mandates exactly two isolated personas (Key Entities) plus
freshness per run; using the product's registration path for E2E keeps the fixture
honest (tests the real five-step flow), while direct seeding keeps fast tiers fast.
Shared-name categories across personas simultaneously exercise the "unique per
user" rule and cross-user isolation.

**Alternatives considered**:
- *Persistent shared seed database* — violates fresh-per-run and reintroduces
  cross-run coupling. Rejected.
- *Factories without personas (ad-hoc rows per test)* — loses the fixed
  owner/second-user vocabulary the spec's acceptance scenarios depend on. Rejected.

## D5 — Component test tooling and accessibility assertions

**Decision**: Component tests use React Testing Library with `user-event` for
realistic keyboard interaction, `@testing-library/jest-dom` matchers for DOM-state
assertions, and `jest-axe` for automated a11y violations (contrast, labels, ARIA)
run per component in both light and dark theme contexts. Announcement checks target
the F007 contracts directly: toast container exposes `aria-live="polite"`, form
errors bind `aria-describedby` to their field and use `role="alert"`, busy triggers
expose `aria-busy`. Tests query by accessible role and name only (behavior, not
implementation).

**Rationale**: FR-008 mandates keyboard operability, visible focus, and
screen-reader announcements; `user-event` + jest-dom + jest-axe are the canonical
RTL companions and test-only devDependencies consistent with the
constitution-approved testing stack (no runtime impact). Querying by role/name keeps
tests refactor-proof (spec Constraint: behavior, not implementation).

**Alternatives considered**:
- *Manual ARIA snapshot assertions only* — misses contrast/label violations axe
  catches mechanically; axe automates what SC-006 demands. Chosen axe in addition.
- *Storybook/Chromatic interaction tests* — new tool, out of approved stack.
  Rejected.

## D6 — E2E matrix strategy (devices × themes)

**Decision**: Playwright projects define the three device classes — Desktop
1280×720, Tablet 768×1024, Mobile 375×667 — and theme is a fixture-controlled
`localStorage["focustodo-theme"]` value plus pre-paint class probe, matching F007's
theme contract. **Key journeys** (register, login, create/edit/complete/search/
filter/delete task, category create/rename/delete, dashboard, logout) run the full
3×2 matrix; remaining coverage samples the matrix (one device per secondary
scenario) rather than skipping it (spec Edge Case: matrix multiplication). Theme
persistence/no-flash (SC-006) is asserted via reload with the pre-paint probe in
both themes; no-horizontal-scroll checks use
`document.scrollingElement.scrollWidth <= clientWidth` at 360/768/1280 px widths
with the F007 stress strings (120-char title, 1000-char description).

**Rationale**: FR-010/FR-012 + SC-002 demand the full matrix for key journeys;
running every scenario × 6 variants would blow the 30-minute budget. Tag-based
selection (`@critical` specs get matrix projects, others run on Desktop) implements
the spec's own sampling rule explicitly and keeps budget math auditable.

**Alternatives considered**:
- *Full matrix for everything* — ~3–4× runtime, breaks SC-004. Rejected.
- *Single "average" viewport only* — directly violates FR-010. Rejected.
- *Visual-regression screenshots* — explicitly out of scope (spec Assumptions).
  Rejected.

## D7 — CI pipeline, budgets, and merge blocking

**Decision**: One PR-triggered workflow with tiered, dependency-chained jobs —
(1) `lint + typecheck` (~1 min), (2) `fast tiers`: unit and component in parallel
(≤5 min combined), (3) `e2e` full suite (E2E runs only after fast tiers pass, to
fail early; total wall clock ≤30 min). All jobs are required status checks; red
blocks merge (SC-005). Durations are reported per job and a budget check fails the
job when a tier exceeds its cap (Edge Case: suite grows slower — no silent creep).
Playwright runs with `retries: 0` in CI — intermittent failures are defects
(US5.3); test titles are behavior sentences ("owner cannot read second user's task
via direct URL") so failure messages name the broken behavior (SC-001).

**Rationale**: FR-016 requires automatic runs on every proposed change within the
5/30-minute budgets; tiering gives fast signal first while the full suite remains
the merge gate. Zero retries aligns the pipeline with the flaky-as-defect policy
instead of masking it.

**Alternatives considered**:
- *CI retries to reduce noise* — masks flakiness; spec forbids "retried until
  green". Rejected.
- *Nightly-only E2E* — violates "runs automatically on every proposed change".
  Rejected.
- *Separate pipelines per tier* — needless orchestration for one app
  (Principle III). Rejected.

## D8 — Flaky quarantine, security-regression, and coverage guards

**Decision**: Three plain-file registries, all enforced in CI by a `governance` job:
1. **Quarantine** (`.flaky.toml`): entries carry test id, owner, reason, fix-by
   date. Quarantined tests run in a separate non-blocking report job — never
   silently skipped, never retried-until-green; a fix-by older than 14 days or a
   missing owner fails the governance job (US5.3; forces fix or removal).
2. **Rule→test manifest** (`tests/helpers/rule-manifest.ts`): every business rule
   from FR-001–FR-006 maps to ≥1 test id; CI verifies each mapped test exists and
   ran green, so deleting a test without an equivalent replacement fails (SC-008);
   deliberately breaking any rule fails ≥1 test whose message names the rule
   (SC-001).
3. **Security regression pack** (`tests/e2e/security/`): a versioned list of every
   previously identified vulnerability/fix mapped to its permanent test; new
   security fixes must append a regression entry in the same PR (FR-015, SC-007).

**Rationale**: The spec demands process guarantees that survive team turnover —
quarantine with owner + fix date, never-decreasing coverage, permanent security
tests. Plain data files plus one governance CI job make each guarantee mechanically
checkable with zero new tooling (Principle III).

**Alternatives considered**:
- *Issue-tracker-only flaky tracking* — not mechanically enforced; drifts. Rejected.
- *Coverage-percentage thresholds only* — line coverage cannot express rule-level
  coverage or prevent targeted test deletion. Rejected.
- *Skipping quarantined tests entirely* — explicitly forbidden ("never silently
  skipped or retried until green"). Rejected.

## Resolved defaults (spec Assumptions → concrete values)

| Open point (spec) | Resolved value |
|---|---|
| Fast-tier budget | ≤5 min combined unit + component (per-tier caps: unit ≤2, component ≤3) |
| Full-suite budget | ≤30 min wall clock in CI, monitored per job |
| Fixture-persona setup | 2 personas/run (owner + second user), unique-suffix emails, fresh per run; product registration path for E2E, direct seed for fast tiers |
| Flaky policy | `.flaky.toml` quarantine with owner + fix-by; ≤14-day window; separate non-blocking report job; zero retries |
| Matrix sampling | Full 3×2 for `@critical` key journeys; Desktop-only for secondary scenarios |
| Browser engine | Chromium in CI (constitution-fixed stack); extra engines optional locally |
| Time zones tested | UTC + one non-UTC zone for server date logic; browser clock pinned in E2E |
| Parallelism | Vitest parallel by default; Playwright `fullyParallel` with per-worker personas; any-order guaranteed by scoped seed/cleanup |
| Quarantine auto-action | fix-by older than 14 days → governance job fails (forces fix or removal) |
| Budget exceed action | Job fails when a tier exceeds its cap |

All Technical Context items resolved; zero `NEEDS CLARIFICATION` markers remain.

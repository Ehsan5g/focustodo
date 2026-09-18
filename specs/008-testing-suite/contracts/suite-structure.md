# Contract: Test Suite Structure & Naming (F008)

**Feature**: `008-testing-suite` | **Date**: 2026-09-18
This contract fixes the canonical layout, naming, and entry points of the
consolidated suite. Every feature's tests (F001–F009) consolidate here; no
per-feature test sprawl (plan.md Structure Decision).

## Tier entry points

| Script | Runner | Environment | Budget |
|---|---|---|---|
| `npm run test:unit` | Vitest | Node (no DOM) | ≤2 min |
| `npm run test:component` | Vitest + RTL | jsdom | ≤3 min |
| `npm run test:e2e` | Playwright | Real Next.js server + `focustodo_test` DB | ≤25 min |
| `npm run test` | all tiers in sequence | — | ≤30 min total |

## Directory layout (canonical)

```text
tests/
├── unit/<family>/             # families: validation, task-rules, filtering,
│                              # categories, authorization, ux-decisions
├── component/<component>/     # one suite per core piece (FR-007 list)
├── e2e/
│   ├── journeys/              # one spec per critical journey (FR-009)
│   ├── responsive/            # device/theme contracts (FR-010, FR-012)
│   ├── resilience/            # slow net, forced failures, rollback (FR-011)
│   ├── security/              # cross-user denial, leakage, regressions (FR-013–015)
│   └── fixtures/              # persona/bootstrap helpers
└── helpers/                   # persona factory, seed/cleanup, time control, rule-manifest
```

## Naming rules

- **Spec files**: `<subject>.test.ts(x)` (unit/component),
  `<journey>.spec.ts` (E2E), colocated per directory above.
- **Test titles are behavior sentences** naming the rule or journey —
  `"rejects a task title longer than 120 characters"`,
  `"owner cannot read second user's task via direct URL"` — so a failure message
  names the broken rule (SC-001) without reading code.
- **Rule IDs**: every unit test enforcing an FR-001–FR-006 rule is tagged
  `testRule('<rule-id>')` (helper wrapping `it`) and registered in
  `tests/helpers/rule-manifest.ts`; unmapped rules fail the governance job.
- **E2E tags**: `@critical` marks key journeys that run the full 3×2 matrix;
  untagged specs run Desktop-only (D6 sampling policy).
- **A11y suites**: every component suite ends with an axe pass per theme; violations
  fail the suite (SC-006).

## Persona & data contract (per FR-017)

- Personas from `tests/helpers/persona.ts`: `createPersona(role, runId)` → typed
  `FixturePersona` (data-model.md); unique-suffix emails; fresh per run.
- Each test file seeds only what it needs via `seedPersona()` and cleans up in
  `afterEach` via `cleanupPersona()` (delete by persona id, never truncate).
- Time: `pinNow(date)` helper wraps `vi.setSystemTime` (unit/component) and
  `page.clock.install` (E2E); no test may read the real clock for assertions.
- Tests assert on observable behavior (roles, names, visible text, API results) —
  never on internal structure, private details, or timing luck (spec Constraint).

## Configuration files (root)

| File | Purpose |
|---|---|
| `vitest.config.ts` | projects `unit` (node env) + `component` (jsdom); coverage provider v8 |
| `playwright.config.ts` | projects desktop/tablet/mobile; `webServer` starts production build against `focustodo_test`; `retries: 0`; `fullyParallel` |
| `.flaky.toml` | quarantine registry (data-model.md; ≤14-day fix-by) |
| `.github/workflows/ci.yml` | tiered blocking jobs + governance job (see contracts/ci-pipeline.md) |

# Data Model: Comprehensive Test Suite (F008)

**Feature**: `008-testing-suite` | **Date**: 2026-09-18
**Scope**: Test-suite-only models. **Zero product DB changes** — the suite exercises
the existing Task/Category/User model (F002–F004) and F007 presentation state
exactly as defined; nothing added or altered (spec Key Entities).

## Test-Suite Entities (test code, not product data)

### FixturePersona

A run-scoped isolated user plus their data; the vocabulary every tier uses.

| Field | Type | Rule |
|---|---|---|
| `role` | `'owner' \| 'second-user'` | exactly one of each per run (spec: at least two isolated users) |
| `runId` | `string` | per-run unique suffix; prevents cross-run/cross-worker collisions |
| `email` | `string` | `persona.<role>.<runId>@test.local`, unique (product rule) |
| `password` | `string` | test-only; used via real registration in E2E |
| `userId` | `string` | assigned after creation/seed |
| `tasks` | `TaskSeed[]` | covers every status × priority × date bucket (overdue / due-today / upcoming / none, incl. midnight & year-end boundaries) |
| `categories` | `CategorySeed[]` | 2 per persona; names shared across personas to prove per-user uniqueness |

**Invariants**: personas never share rows (Edge Case: fixtures would mix users'
data); created fresh per run, never persisted across runs; E2E personas are created
through the product's own registration flow.

### TaskSeed / CategorySeed

| Field | Type | Rule |
|---|---|---|
| `title` | `string` | product rule 1–120 chars; stress fixtures include a 120-char title and 1000-char description |
| `status` | `'TODO' \| 'IN_PROGRESS' \| 'COMPLETED'` | enum values exercised exhaustively in unit pack |
| `priority` | `'LOW' \| 'MEDIUM' \| 'HIGH'` | enum values exercised exhaustively |
| `dueDate` | `Date \| null` | relative to pinned test "now" (D3) |
| `categoryId` | `string \| null` | exercises assignment/removal rules (FR-004) |
| `name` (category) | `string` | unique per user (product rule) |

### RuleManifestEntry (`tests/helpers/rule-manifest.ts`)

The SC-008 coverage-never-decreases registry.

| Field | Type | Rule |
|---|---|---|
| `ruleId` | `string` | canonical id from FR-001–FR-006 enumeration (e.g., `FR-001.title-length`) |
| `ruleName` | `string` | human-readable rule; must appear in the mapped test's failure message (SC-001) |
| `testIds` | `string[]` | ≥1; every id must exist in the suite and run green in CI |
| `tier` | `'unit' \| 'component' \| 'e2e'` | which pack guards the rule |

**Invariant**: deleting or renaming a mapped test without replacing it fails the
governance CI job; adding a rule without a manifest entry fails review.

### QuarantineEntry (`.flaky.toml`)

| Field | Type | Rule |
|---|---|---|
| `testId` | `string` | unique; identifies the quarantined test |
| `owner` | `string` | required — missing owner fails governance job |
| `reason` | `string` | observed failure signature |
| `fixBy` | `date` | ≤14 days out; overdue entries fail the governance job (forces fix or removal) |

**Lifecycle**: `added (flaky observed) → quarantined (runs in non-blocking report
job) → fixed (entry removed, test returns to blocking tier) — or removed (test
deleted with governance approval)`. Never silently skipped; never retried until
green (zero retries in CI).

### SecurityRegressionEntry (`tests/e2e/security/REGRESSIONS.md` + manifest)

| Field | Type | Rule |
|---|---|---|
| `fixId` | `string` | versioned id for the vulnerability/fix |
| `summary` | `string` | what was fixed (no sensitive detail) |
| `testIds` | `string[]` | permanent tests asserting the fix; reverting any fix fails the suite (SC-007) |
| `landedIn` | `date` | provenance |

**Invariant**: new security fixes must append an entry in the same PR (FR-015);
entries are never deleted.

## State Model: Suite Results

| State | Meaning | Transition |
|---|---|---|
| `green` | all tiers pass within budgets | merge allowed |
| `red` | any tier or governance job fails | merge blocked (SC-005); fix takes priority over feature work (spec Assumptions) |
| `red:security` | any authorization/leakage test fails | blocks everything (Edge Case: authorization hole takes priority over all work) |
| `quarantined` | known-flaky test isolated | non-blocking report only; tracked in `.flaky.toml` |

## Relationships

- `FixturePersona 1 — * TaskSeed / CategorySeed` (ownership mirrors product model;
  cross-persona access is the security pack's test surface)
- `RuleManifestEntry * — 1..* testIds` (rule → guarding tests)
- `QuarantineEntry 1 — 1 testId`
- `SecurityRegressionEntry 1 — * testIds`

## FR → Model Traceability

| FR | Model(s) |
|---|---|
| FR-001–FR-004 | TaskSeed/CategorySeed fixture shapes; RuleManifestEntry |
| FR-005/FR-013/FR-014 | FixturePersona pair; SecurityRegressionEntry |
| FR-006 | TaskSeed buckets; pinned-time fixtures (D3) |
| FR-007/FR-008 | component pack suites (structure in plan.md; no new model) |
| FR-009–FR-012 | E2E persona + device/theme fixtures (D4/D6) |
| FR-015 | SecurityRegressionEntry |
| FR-016 | Suite Results state model; budget caps (D7) |
| FR-017 | FixturePersona/Seed invariants (per-run, parallel-safe) |
| SC-001/SC-008 | RuleManifestEntry |
| SC-005 | Suite Results + governance job |
| SC-007 | SecurityRegressionEntry |

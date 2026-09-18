# Contract: CI Pipeline & Process Gates (F008)

**Feature**: `008-testing-suite` | **Date**: 2026-09-18
This contract defines the automation that runs the suite on every proposed change
and the process guarantees enforced mechanically (FR-016, SC-005, SC-007, SC-008).

## Pipeline (PR-triggered, all jobs required status checks)

```text
job: lint-typecheck        (~1 min)   eslint + tsc --noEmit (product AND test code)
job: unit                  (≤2 min)   depends on lint-typecheck
job: component             (≤3 min)   depends on lint-typecheck
job: e2e                   (≤25 min)  depends on unit + component passing
job: governance            (~1 min)   registry checks (below); depends on nothing
job: flaky-report          (non-blocking)  runs quarantined tests, posts status
```

- Wall clock budget ≤30 min (SC-004); each job asserts its own duration cap and
  fails when exceeded (Edge Case: suite grows slower — no silent creep).
- **Red blocks merge 100% of the time** — any failing required job blocks (SC-005).
- Playwright `retries: 0`; flakiness is handled by quarantine, never retries (US5.3).
- `flaky-report` is informational only and can never turn a pipeline green.

## Governance job checks (all plain-file, zero new tooling)

1. **Quarantine registry** (`.flaky.toml`): every entry has owner + reason +
   fix-by; any entry with `fixBy < today` or empty owner → fail.
2. **Rule manifest** (`tests/helpers/rule-manifest.ts`): every `ruleId` has ≥1
   existing test id; a manifest-vs-suite diff (exported test id list) with missing
   ids → fail. Guarantees SC-008 (coverage never decreases) and SC-001
   (rule-naming failures) mechanically.
3. **Security regression pack**: every entry in
   `tests/e2e/security/REGRESSIONS.md` maps to an existing permanent test; a PR
   touching a security fix without a new entry → review flag + fail (FR-015).

## Environment contract

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | points at `focustodo_test` (Docker Compose service `db-test`) |
| `AUTH_SECRET` | test-only secret; production secrets never used in tests |
| `CI` | standard flag; enables budget enforcement + retries=0 |

- Tests never depend on third-party availability (FR-017); the workflow installs
  dependencies from the lockfile only.
- Test artifacts (Playwright traces/reports) upload on failure for diagnosis;
  traces are deleted from runners after upload (no data retention).

## Definition of done for this contract

A change merges only when: lint/typecheck green → fast tiers green ≤5 min → E2E
green (full matrix for `@critical`) → governance green. Failure messages name the
broken behavior; budget breaches are visible failures, not warnings.
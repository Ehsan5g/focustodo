# Implementation Plan: Task Search & Filters (F005)

**Branch**: `005-search-filters` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-search-filters/spec.md`

**Branch note**: The repository is not yet a git repository (F001 T001 pending). `setup-plan.ps1 -Json` was run with the sanctioned `SPECIFY_FEATURE` / `SPECIFY_FEATURE_DIRECTORY` override so the active feature resolves to `005-search-filters` (`.specify/feature.json` now points at `specs/005-search-filters`), and the script copied the plan template here.

**Clarification note**: The spec closed its 2026-09-17 clarify session with one decision — the list updates only when the search is submitted (Enter or the search control); no per-keystroke narrowing and no debounce (FR-001). Every other category was already Clear, so planning receives zero NEEDS CLARIFICATION items; the open questions below are implementation-design decisions, resolved in research.md.

## Summary

Search, filters, sorting, and reset over the existing per-user task list — no new entity, no migration. The user's criteria (search text, status, priority, category, due-date preset, sort choice) are transient view settings of the list session (spec Assumptions): the `/` page server-renders the default list (all tasks, newest first), and a client container owns the criteria state, re-reading through a five-step server action (`fetchTasks`) whenever criteria change. That action validates the criteria against the constitution-mandated shared Zod schema (`taskFilterSchema`, constitution II), authenticates via `requireSession()`, and queries with ownership as the base predicate (`where: { userId, …criteria }` — constitution I, FR-011). Search matches title or description case-insensitively via parameterized `contains`, with LIKE wildcards escaped in the pure query builder so every character matches literally; a submitted empty or whitespace-only search shows all tasks (FR-001). Due-date presets are derived at query time in UTC calendar days — overdue = past-due and not completed (F003's definition, never stored); "Due this week" = today through today+6; "No due date" = `dueDate: null`. Every sort explicitly places tasks without a due date last and breaks ties newest-first (FR-007). The result returns mapped `TaskDto`s plus the match count: while any criterion is active the view shows the count (FR-008) and, on zero matches, an empty state whose reset control (FR-009) and the toolbar's reset (FR-010) restore all tasks, newest first. Mutations keep the view current by re-querying the active criteria (FR-013); a category deleted elsewhere vanishes from the filter options and the category filter is dropped automatically. The index evaluation the constitution mandates lands in D6 — existing indexes cover the patterns at this scale, with explicit revisit triggers. Vitest + React Testing Library + Playwright cover schema boundaries, the pure query builder (windows, overdue, tie-breaks), service authorization, components, and E2E journeys including User A / User B (SC-003) and 100+ task responsiveness (SC-006). All design decisions (D1–D9) are resolved in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict mode) on Node.js 22 LTS; npm (inherited from F001 research.md D1–D2)

**Primary Dependencies**: Next.js 16 (App Router), React 19, Zod, Prisma ORM, Tailwind CSS + shadcn/ui conventions — **zero new runtime dependencies**: the filter bar uses native form + select elements in the established conventions (research D7)

**Storage**: PostgreSQL 16 in the F001 Docker container — **no schema change**: F005 is a read-path feature over the existing `Task`/`Category` tables; no migration (research D9)

**Testing**: Vitest (unit) + React Testing Library (component) + Playwright E2E on Chromium — filter schema boundaries, pure query-builder semantics (overdue, windows, nulls-last, tie-breaks), service authorization, filter bar/list/empty-state components, full search/filter/sort/reset journeys, cross-user security, 100+ task scale (research D8)

**Target Platform**: Local development (macOS/Windows/Linux); current stable Chrome/Firefox/Safari; responsive 320–1280 px (desktop/tablet/mobile per constitution V)

**Project Type**: Single full-stack Next.js application (extends the F001 skeleton + F002 auth + F003 tasks + F004 categories in place)

**Performance Goals**: Searching for a word among 100 tasks returns matches within 2 seconds under normal local conditions (SC-001); applying, changing, or clearing any filter or sort updates the list within 2 seconds (SC-002); with 100+ tasks search, filters, sorting, and reset stay fully responsive on desktop, tablet, and mobile with no horizontal scrolling (SC-006); F001 quality-gate budgets inherited unchanged

**Constraints**: Every search/filter/sort request executes through a five-step server action returning stable serializable data — never raw database objects (user-mandated constraint); `taskFilterSchema` is the single source of truth for filter criteria between client and server (constitution II); ownership is the base predicate of every list query (FR-011, constitution I); the list updates only on search submit — no per-keystroke narrowing, no debounce (clarification 2026-09-17); criteria are session-only view settings — not in the URL, not persisted (spec Assumptions); overdue and due-date windows are derived at query time, never stored (F003 D1 invariant); malformed criteria fail safely before any query (FR-012); filtering/sorting logic is pure and unit-tested (constitution IV); no new runtime libraries, no new environment variables, no migration (D9)

**Scale/Scope**: 0 new routes, 0 new entities, 0 migrations; 1 new shared schema file, 1 pure query-builder module, 1 thin five-step read action, the filter bar + list container components on the existing `/` page; 5 user stories, 15 FRs, 12 edge cases, 8 success criteria

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Server-Authoritative Security (NON-NEGOTIABLE)**: PASS — the read action authenticates via `requireSession()` (F002); no criteria field can carry a `userId`; ownership is the base query predicate (`where: { userId, …criteria }`, FR-011) so no search/filter combination can surface another user's tasks (US1 S4, SC-003); all criteria are re-validated server-side before any query executes (FR-012, constitution I); a foreign/unknown `categoryId` in a read request is rejected as a validation error before any query runs — foreign ids, unknown ids, and deleted ids are indistinguishable and nothing leaks (D4); results are mapped DTOs — `userId` and internal fields never cross to the client.
- **II. Type Safety and Strict Validation**: PASS — `src/validation/task-filter-schema.ts` is exactly the shared "task filters" schema the constitution names; enums for status/priority/due-date presets/sort make impossible criteria unrepresentable; search normalization (trim, whitespace-only → no search) lives in the one shared schema; TypeScript strict, no `any`; the shared schema is imported by the client controls and the server action alike.
- **III. Modular Architecture and Simplicity**: PASS — F001–F004 separation preserved: `src/validation/` (shared schema), `src/server/tasks/task-query.ts` (pure, unit-tested criteria→where/orderBy mapping), a thin read action, and feature components under `src/features/tasks/`; the page stays a Server Component rendering the default list; client code never touches Prisma; queries select only the fields the list needs; **zero new dependencies and zero new abstractions** — no state library, no router-cache layer, no debounce utility (the clarification removed the last candidate); index evaluation is recorded with explicit revisit triggers (D6) rather than speculative compound indexes.
- **IV. Test-First Quality Gates (NON-NEGOTIABLE)**: PASS — planned coverage (D8) maps 1:1 to FR-015: unit (schema boundaries; query builder incl. overdue definition, window boundaries, nulls-last, tie-breaks; service authorization with mocked Prisma/`requireSession` incl. forged criteria), component (submit-only search behavior, selects, count line, empty state + reset), E2E (every US journey, combination matrix, mutations-while-filtered FR-013, stale-category reconciliation, User A/B security SC-003, 100+ task scale SC-006). Tests are written and observed failing before the code that satisfies them.
- **V. Production UX, Accessibility, and Performance**: PASS — every control is keyboard operable with visible focus and a clear label (FR-014); the search box exposes both Enter and an explicit submit control; the count line (FR-008) and the no-match empty state with reset (FR-009/FR-010) prevent dead ends; a pending indicator covers the async re-read; the bar stacks responsively with no horizontal scrolling at any viewport (SC-006); no meaning is conveyed by color alone; the empty state provides the next action (constitution V).
- **Technology and Security Constraints**: PASS — reads as well as mutations follow the five-step action contract and return serializable DTOs (user-mandated constraint); Prisma is confined to `src/server/`; search uses parameterized `contains` with `mode: "insensitive"`, and the pure builder escapes LIKE wildcards (`\`, `%`, `_`) so user input never interpolates into raw SQL and special characters match literally — `%`, quotes, and emoji can neither error nor widen the match (spec edge case); the approved stack is unchanged; zero new runtime dependencies (D7); no new environment variables and no migration (D9); no logging of user content — diagnostics only, server-side.

**Pre-Phase-0 Verdict**: No unjustified violations — Phase 0 research may proceed.

## Project Structure

### Documentation (this feature)

```text
specs/005-search-filters/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── server-actions.md
│   └── routes-and-surfaces.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

F005 extends the F001–F004 tree in place (no structural change, no migration); new and modified paths only:

```text
src/validation/task-filter-schema.ts       # ADD: shared taskFilterSchema — search/status/priority/categoryId/dueDate preset/sort (constitution II, D2)
src/server/tasks/task-query.ts             # ADD: pure criteria → where/orderBy mapping incl. due-date windows, nulls-last, tie-breaks (D3, D4)
src/server/tasks/service.ts                # EXTEND: the F003 list read becomes the criteria-aware service behind fetchTasks (D1)
src/server/actions/task-filter-actions.ts  # ADD: fetchTasks — the five-step read action all search/filter/sort requests ride (user-mandated constraint, D1)
src/features/tasks/                        # EXTEND: TaskFiltersBar (search form, selects, sort, reset), TaskListContainer (client criteria state, count line, empty state), list rendering (D5, D7)
src/app/(protected)/page.tsx               # EXTEND: server-renders the default-criteria list + category options into the client container (D1, D7)
tests/unit/                                # ADD: task-filter schema boundaries; query-builder semantics (overdue/windows/nulls-last/ties); service authorization + forged-categoryId safety (D8)
tests/component/                           # ADD: filter bar (submit-only search, selects, reset), count line, no-match empty state (D8)
tests/e2e/task-filters.spec.ts             # ADD: search/filter/sort/reset journeys, combinations, mutations-while-filtered, User A/B security (SC-003), 100-task scale (SC-006) (D8)
```

**Structure Decision**: Single full-stack Next.js project, extending the F001–F004 tree with its shape unchanged (npm, `src/` + `tests/` at repository root, Prisma confined to `src/server/`, shared Zod schemas in `src/validation/`). F005 adds one shared schema file, one pure query-builder module, one thin read action, and the filter/list-container components on the existing `/` page — and touches no database table: search and filters are read-path logic over the task and category data the constitution already names. Zero new routes; everything else extends existing files.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | — | — |

No constitution violations: the feature is read-path logic over existing tables — the only additions are the constitution-mandated shared filter schema, one pure query builder, one thin five-step read action, and two feature components; URL reflection and any persistence of view settings are explicitly out of scope (spec Assumptions), and the index question is resolved by evaluation-with-deferral (D6) rather than speculative compound indexes.

**Post-Phase-1 Re-check**: PASS — after research.md (D1–D9), data-model.md, contracts/, quickstart.md: Principle I holds by construction — `fetchTasks` authenticates first, validates second, resolves any `categoryId` against `{ id, userId }` before querying, and keeps ownership as the base predicate for search, filters, count, and sort (FR-011, SC-003). Principle II holds: one shared `taskFilterSchema` (create/edit schemas untouched); strict TS untouched; criteria normalization lives only in the schema (D2). Principle III: no new dependencies, no new abstractions — one schema file, one pure query-builder module, one thin read action, two feature components; the default view remains server-rendered; the index evaluation is recorded with deferral rationale and revisit triggers (D6). Principle IV: D8 + quickstart.md's automated gates materialize FR-015's coverage. Principle V: the surface/a11y contract is pinned in contracts/routes-and-surfaces.md (FR-008/FR-009/FR-010/FR-014). Technology constraints: five-step read action returning DTOs (D1), parameterized + wildcard-escaped insensitive search (D3), zero new dependencies, zero new environment variables, zero migrations (D9).

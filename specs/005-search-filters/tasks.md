---
description: "Task list for F005 Task Search & Filters"
---

# Tasks: Task Search & Filters (F005)

**Input**: Design documents from `/specs/005-search-filters/`

**Prerequisites**: plan.md ✅ (constitution check PASS pre- and post-Phase 1), spec.md ✅ (clarify session closed — submit-only search), research.md ✅ (decisions D1–D9, zero open items), data-model.md ✅ (TaskCriteria shape, derivation rules, ten invariants), contracts/ ✅ (server-actions — the `fetchTasks` read contract; routes-and-surfaces), quickstart.md ✅ (S1–S15)

**Tests**: Included — constitution IV mandates the unit/component/E2E gates, and FR-015 with SC-003/SC-006 explicitly assigns this feature the search/filter coverage F003 and F004 deferred; D8 pins the strategy: schema-boundary unit tests, pure-builder unit tests (the FR-015 overdue/tie-break layer), service tests with a mocked Prisma client, component tests for the bar/container/empty state, and Playwright journeys — cross-user scenarios via request interception, never timing sleeps (the clarified submit-only search makes every journey deterministic).

**Organization**: Grouped by user story — US1 Search the Task List (P1), US2 Filter by Status and Priority (P1), US3 Filter by Category and Due Date (P2), US4 Sort the Task List (P2), US5 Combine Filters and Reset (P2). The read contract per `contracts/server-actions.md`; bar/container/surface semantics per `contracts/routes-and-surfaces.md`; the TaskCriteria shape, UTC windows, and the ten invariants per `data-model.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

## Path Conventions

Single full-stack Next.js project extending F001+F002+F003+F004 in place (plan.md): the shared Zod schema in `src/validation/task-filter-schema.ts` (new); the pure query builder in `src/server/tasks/task-query.ts` (new) beside the extended `src/server/tasks/service.ts`; actions in `src/server/actions/` (`task-filter-actions.ts` is new; no existing action changes); feature UI in `src/features/tasks/` (`TaskListContainer.tsx`, `TaskFiltersBar.tsx` are new; `TaskItem`/create-edit control extended only for the `onSettled` callback); the task list stays at `/` (`src/app/(protected)/page.tsx` extended). F005 adds exactly ZERO routes and ZERO schema changes (D9); Prisma stays confined to `src/server/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch on a green F003+F004 baseline — no new dependencies, no env changes, no migration (D9).

- [ ] T001 Confirm F003 and F004 are complete with all quality gates green (`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run test:e2e`), then create and switch to branch `005-search-filters` (if no git repo exists yet, first execute F001 T001 — `.gitignore` before any commit)

**Checkpoint**: Branch `005-search-filters` from a fully green baseline; nothing new installed, nothing migrated (D9).

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared filter schema, the pure query builder, the criteria-aware read service, and the one new five-step read action — the substrate every story reads through.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 [P] Write the failing unit tests for the shared filter schema in `tests/unit/task-filter-schema.test.ts` (D2; data-model validation rules): `search` trimmed to 1–200 characters after trim (1 accepted, 200 accepted, 201 rejected) with whitespace-only normalized to "no criterion"; `status`/`priority` enums reject unknown values; `categoryId` non-empty string; `dueDate` preset enum `OVERDUE|DUE_TODAY|DUE_THIS_WEEK|NO_DUE_DATE`; `sort` defaults to `NEWEST_FIRST` and rejects unknown values; every absent optional = All
- [ ] T003 [P] Write the failing unit tests for the pure query builder in `tests/unit/task-query.test.ts` (D3; data-model derivation rules — the FR-015 overdue/tie-break layer): search becomes the `OR` of title/description `contains` with `mode: "insensitive"` and the ESCAPED token (`\`, `%`, `_` doubled; quotes/emoji untouched); status/priority/category equality only when present; `OVERDUE` = `dueDate < today` AND `status != COMPLETED` (a completed task due tomorrow is NOT overdue — edge case); `DUE_TODAY` = `[today, today+1)` and `DUE_THIS_WEEK` = `[today, today+7)` boundary-exact; `NO_DUE_DATE` = `null` and dated presets exclude undated tasks; all five orderBy mappings incl. due-date nulls-last and the `createdAt desc` tie-break on every non-createdAt sort; combined criteria AND together
- [ ] T004 [P] Write the failing unit tests for the criteria-aware read service with a mocked Prisma client in `tests/unit/task-filter-service.test.ts` (D1, D4; data-model invariants 1–4, 7): every read's `where` starts from `{ userId }` entering only via `requireSession()`; a present `categoryId` resolves via `category.findFirst({ where: { id, userId } })` BEFORE any task query — a foreign/unknown/just-deleted id yields the `categoryId` field error and NO task query runs; `total === tasks.length`; rows map to `TaskDto` (id, title, description, status, priority, dueDate ISO day, createdAt, categoryName) — no raw Prisma objects and no `userId` in the result
- [ ] T005 Create `src/validation/task-filter-schema.ts` making T002 pass: `taskFilterSchema` — the single Zod source of truth shared by client and server (constitution II; D2) (depends on T002)
- [ ] T006 Create `src/server/tasks/task-query.ts` making T003 pass: pure `buildTaskQuery(criteria, now)` → `{ where, orderBy }` — no Prisma client import, no React (constitution IV; D3) (depends on T003, T005)
- [ ] T007 Extend the list read in `src/server/tasks/service.ts` making T004 pass: accept the built criteria, resolve the category criterion (D4), select only the list-view fields (+ the `category.name` join), map rows to `TaskDto`, return tasks + `total` (depends on T004, T005, T006)
- [ ] T008 Create `src/server/actions/task-filter-actions.ts` with the five-step `fetchTasks(criteria)` → `TaskListResult` exactly per contracts/server-actions.md — validate → authenticate → authorize → execute → return; `requireSession()` called on every invocation (D1) (depends on T005, T007)
- [ ] T009 Run every quality gate (`npm run typecheck && npm run lint && npm run format:check && npm run test`) and commit the foundational slice (depends on T002–T008)

**Checkpoint**: The read substrate is test-green and ownership-safe — every story now consumes the same schema, builder, service, and action.

## Phase 3: User Story 1 — Search the Task List (P1) 🎯 MVP

**Goal**: A signed-in user narrows the list to tasks whose title or description contains the submitted search text, ignoring letter case — submit-only (FR-001; the clarified decision).

**Independent Test**: Create tasks with matching and non-matching titles/descriptions; search by word, partial word, and case variations; verify only matching tasks appear; clear to restore.

- [ ] T010 [US1] Write the failing component tests for the filter bar's search in `tests/component/TaskFiltersBar.test.tsx` (FR-001, D5): the input is labeled; typing WITHOUT submitting fires NO request and the list is unchanged; pressing Enter submits once; clicking the explicit search control submits once; a whitespace-only submit sends "no criterion" (not the spaces); an over-200-character post-trim value is rejected inline before any submit
- [ ] T011 [P] [US1] Write the failing E2E journeys for search in `tests/e2e/task-search.spec.ts` (FR-001; quickstart S1–S3): title matches; description-only matches (edge case); case-insensitive matches; spaces-only shows all; `%`/quotes/emoji match literally and never error (edge case); the list stays unchanged while typing (edge case); clearing restores the full list
- [ ] T012 [US1] Create `src/features/tasks/TaskListContainer.tsx` (client) making T010 pass: owns the criteria in `useState` seeded from the page's initial data; calls `fetchTasks` (exactly one request per change, last-change-wins serialization — routes contract rule 1); a visible pending indicator while a read is in flight; renders `TaskFiltersBar` + the list + the count/empty surfaces (the latter two land with US5 — until then the full result renders as the F003 list) (depends on T008, T010)
- [ ] T013 [US1] Create `src/features/tasks/TaskFiltersBar.tsx` (client) making T010 pass: a labeled search `<form>` whose ONLY submit path is Enter or the explicit control (no onChange narrowing — no debounce exists, D5); inline error adjacent to the field for the too-long case (depends on T010, T012)
- [ ] T014 [US1] Extend `src/app/(protected)/page.tsx`: render `TaskListContainer` seeded with the DEFAULT server-rendered list (all of the user's tasks, newest first — F003 read unchanged) and the user's category options (`{ id, name }`, `nameKey` asc — the F004 projection); the page remains a Server Component (D1) (depends on T012)
- [ ] T015 [US1] Validate US1 independently: T010/T011 green; quickstart S1–S3 manual pass; gates green; commit

**Checkpoint**: Search works end-to-end submit-only and case-insensitively over title + description — the MVP slice.

## Phase 4: User Story 2 — Filter by Status and Priority (P1)

**Goal**: A signed-in user narrows the list by status (All / To Do / In Progress / Completed) and by priority (All / Low / Medium / High); both combine with search (FR-002, FR-003).

**Independent Test**: Create tasks across statuses and priorities; apply each option and combinations; verify only fully matching tasks appear.

- [ ] T016 [US2] Write the failing component tests for the status + priority selects in `tests/component/TaskFiltersBar.test.tsx` (FR-002/FR-003): both controls are labeled; selecting an option fires exactly one `fetchTasks` immediately (selects submit on change — D5, unlike search); "All" sends an absent criterion; the bar's async pending state is visible
- [ ] T017 [P] [US2] Write the failing E2E journeys for status + priority in `tests/e2e/task-filters.spec.ts` (FR-002/FR-003; quickstart S4): each status option shows exactly its tasks; each priority option likewise; status + priority + search AND together (FR-006)
- [ ] T018 [US2] Extend `src/features/tasks/TaskFiltersBar.tsx` making T016 pass: labeled status and priority selects over the shared enum values; on change the container refetches with the new criteria (depends on T016, T012)
- [ ] T019 [US2] Validate US2 independently: T016/T017 green; quickstart S4 manual pass; gates green; commit

**Checkpoint**: Status and priority filter correctly and combine with search.

## Phase 5: User Story 3 — Filter by Category and Due Date (P2)

**Goal**: A signed-in user narrows by category (All + only their own categories) and by due-date preset (All / Overdue / Due today / Due this week / No due date), with the overdue and window semantics locked in the query builder (FR-004, FR-005).

**Independent Test**: Create tasks with known categories and due dates (past, today, this week, none); apply each preset and category filter; verify exactly the matching tasks appear.

- [ ] T020 [US3] Write the failing component tests for the category + due-date selects in `tests/component/TaskFiltersBar.test.tsx` (FR-004/FR-005): the category select offers All + the user's own categories only (from the seeded options — never fabricated); the due-date select offers the five presets; changing either fires exactly one refetch; when a refetch returns the `categoryId` field error, the container DROPS the stale criterion and refetches once — the options list no longer offers the deleted category (D4 self-heal)
- [ ] T021 [P] [US3] Write the failing E2E journeys for category + due date in `tests/e2e/task-filters.spec.ts` (FR-004/FR-005; quickstart S5–S6): per-category isolation across two users (only own categories offered); Overdue shows only past-due NOT-completed tasks; Due today / Due this week windows boundary-exact; No due date shows exactly the undated tasks and dated presets never include them; the stale-category self-heal journey (delete while filtering → drops from options, remaining criteria apply, no error — edge case)
- [ ] T022 [US3] Extend `src/features/tasks/TaskFiltersBar.tsx` making T020 pass: labeled category select (options from the container's state, refreshed after mutations) and due-date preset select; wire the stale-category drop through the container's refetch path (depends on T020, T018)
- [ ] T023 [US3] Validate US3 independently: T020/T021 green; quickstart S5–S6 + S13 manual pass; gates green; commit

**Checkpoint**: All five filters work with spec-exact overdue/window semantics and the stale-category edge case heals itself.

## Phase 6: User Story 4 — Sort the Task List (P2)

**Goal**: A signed-in user reorders the currently shown list with the five sorts, tie-breaking newest-first, undated tasks last under due-date sorting (FR-007).

**Independent Test**: Create tasks with known creation order, due dates, priorities, and titles; apply each sort — including while a search or filter is active — and verify the exact order.

- [ ] T024 [US4] Write the failing component test for the sort select in `tests/component/TaskFiltersBar.test.tsx` (FR-007): the control is labeled with the five options, Newest first preselected; changing it fires exactly one refetch and never widens a narrowed list
- [ ] T025 [P] [US4] Write the failing E2E journeys for sorting in `tests/e2e/task-sort.spec.ts` (FR-007; quickstart S7–S8): each of the five sorts over mixed tasks (same priority, same due date, undated); ties resolve newest-first; undated tasks sort last under due-date ordering; sorting a searched list reorders without widening it
- [ ] T026 [US4] Extend `src/features/tasks/TaskFiltersBar.tsx` making T024 pass: labeled sort select wired to the container's `sort` criterion (depends on T024, T018)
- [ ] T027 [US4] Validate US4 independently: T024/T025 green; quickstart S7–S8 manual pass; gates green; commit

**Checkpoint**: The list orders exactly per the five sorts with stable newest-first ties.

## Phase 7: User Story 5 — Combine Filters and Reset (P2)

**Goal**: A signed-in user combines every criterion (AND semantics), sees the live match count, gets a clear no-match empty state with a reset, and can reset from anywhere — including mutations keeping the filtered view fresh (FR-006, FR-008–FR-010, FR-013).

**Independent Test**: Apply several criteria together and verify only fully matching tasks appear; verify the count; verify reset restores defaults from the bar and from the empty state; create/complete/delete while filtered.

- [ ] T028 [US5] Write the failing component tests for combination, count, and empty state in `tests/component/TaskListContainer.test.tsx` (FR-006/FR-008/FR-009/FR-010): combined criteria send all values in one `fetchTasks`; the count line renders ONLY while a criterion is active and shows `total`; `total === 0` with active criteria swaps in the no-match empty state with a reset action; the empty-state reset restores defaults (empty search, All ×4, Newest first) and refetches; a taskless user still sees F003's helpful empty state with its create action (routes contract rule 4)
- [ ] T029 [P] [US5] Write the failing E2E journeys for combination, reset, and freshness in `tests/e2e/task-search.spec.ts` (FR-006/FR-008–FR-010/FR-013; quickstart S9–S12): search + category + status AND together with the count shown (US5 S1); no-match empty state and its reset (US5 S2); full reset and reload-returns-defaults (US5 S3); freshness — create a matching task → appears; complete/delete a matching task → leaves the view; complete the overdue task → leaves Overdue (US5 S4, edge cases)
- [ ] T030 [US5] Extend `src/features/tasks/TaskListContainer.tsx` making T028 pass: the count line (aria-live polite), the no-match empty state + its reset, the bar-level "Reset filters" control visibility rule (visible while ANY criterion is active — FR-010), and the `onSettled` mutation-refresh wiring: the create/edit control and `TaskItem` call back after any result and the container refetches the ACTIVE criteria (FR-013, D5) (depends on T028, T013, T022)
- [ ] T031 [US5] Extend `src/features/tasks/TaskItem.tsx` and the create/edit task control: fire the `onSettled` callback prop after each mutation result (create, edit, complete/reopen, delete) — no mutation logic changes (D9) (depends on T030)
- [ ] T032 [US5] Validate US5 independently: T028/T029 green; quickstart S9–S12 manual pass; gates green; commit

**Checkpoint**: The combined experience is complete — AND semantics, live count, no-match empty state, two-path reset, and a never-stale filtered view.

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final compliance sweep and full-acceptance validation of the whole feature.

- [ ] T033 [P] Update `README.md`: add a "Task Search & Filters" subsection under key architectural decisions (one five-step read action `fetchTasks` over a client-owned criteria state — D1; the shared `taskFilterSchema` as constitution II's "task filters" schema — D2; the pure `buildTaskQuery` with LIKE-escaping, UTC windows, and newest-first tie-breaks — D3; owner-resolved category criterion with self-healing drop — D4; submit-only search — D2/D5; index evaluation with recorded revisit triggers, zero built — D6; zero new migrations/dependencies/env vars — D9)
- [ ] T034 Run the FR/SC acceptance sweep: execute the full quickstart.md S1–S15 manually (incl. S14's cross-user check note and S15's 100-task scale — bar, count, and list fully usable with no horizontal scrolling at 320–1280 px, plus the keyboard-only walk with color disabled — SC-006, FR-014); run every automated gate (`npm run typecheck && npm run lint && npm run format:check && npm run test && npm run test:e2e`) confirming the FR-015 coverage incl. the F003/F004-deferred security test (User A never surfaces User B's tasks through any search or filter — SC-003); confirm no raw Prisma objects cross the server/client boundary, no `userId` appears in any DTO or criteria payload, and no user content or internals appear in any error or log (data-model invariants 1–10); commit the completed feature on `005-search-filters`

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first (branch)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. Test-first pairs: T002→T005, T003→T006 (T006 also consumes T005), T004→T007 (T007 also consumes T005, T006), then T008, T009 last (gates + commit)
- **US1 (Phase 3)**: Depends on Phase 2; T010∥T011 first (failing), then T012, T013 (T012 also consumes T008), then T014, then T015
- **US2 (Phase 4)**: Depends on US1 (the bar and container exist); T016∥T017 first, then T018, then T019
- **US3 (Phase 5)**: Depends on US2 (the bar's established pattern); T020∥T021 first, then T022, then T023
- **US4 (Phase 6)**: Depends on US2 (the bar); T024∥T025 first, then T026, then T027
- **US5 (Phase 7)**: Depends on US1–US4 (the full criteria surface); T028∥T029 first, then T030 → T031, then T032
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1 → US2 → US3 → US4 → US5** in spec priority order: US1 delivers the container + bar skeleton every later control mounts into; US2 (P1) adds the two plain selects; US3 (P2) adds the owner-resolved selects and the self-heal path; US4 (P2) adds the sort select; US5 (P2) is pure composition — count, empty state, reset, and freshness wiring over everything before it
- Each story validates independently at its checkpoint (quickstart slices S1–S3, S4, S5–S6+S13, S7–S8, S9–S12)
- All stories share `src/features/tasks/TaskFiltersBar.tsx`, `TaskListContainer.tsx`, and `tests/component/TaskFiltersBar.test.tsx`, so implement them sequentially (a second developer can still pre-write each story's test-first files — no same-file conflicts among TEST tasks)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- The read action and its semantics (Phase 2) before the client surface that calls it
- Core implementation before the story's independent validation task
- Story complete before moving to the next priority

### Parallel Opportunities

- Phase 2: T002∥T003∥T004 (independent test files)
- US1: T010∥T011; US2: T016∥T017; US3: T020∥T021; US4: T024∥T025; US5: T028∥T029 (component vs E2E files)
- Polish: T033 [P]

## Parallel Example: User Story 1

```bash
# Launch the two independent test-first files together (write first, keep failing):
Task: "Component tests for the search box in tests/component/TaskFiltersBar.test.tsx"
Task: "E2E search journeys in tests/e2e/task-search.spec.ts"

# After the tests exist, the container and bar land:
Task: "TaskListContainer client state + fetchTasks wiring in src/features/tasks/TaskListContainer.tsx"
Task: "Search form (submit-only) in src/features/tasks/TaskFiltersBar.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup → 2. Phase 2: Foundational → 3. Phase 3: US1
4. **STOP and VALIDATE** (quickstart S1–S3) — the MVP: submit-only, case-insensitive search over title + description through an ownership-scoped read

### Incremental Delivery

1. Setup + Foundational → the read substrate (shared schema, pure builder, scoped service, one action)
2. US1 → search (MVP)
3. US2 → status + priority filters (the P1 pair completes)
4. US3 → category + due-date filters with spec-exact windows and the self-heal
5. US4 → the five sorts with stable tie-breaks
6. US5 → combination, count, no-match empty state, reset, freshness
7. Polish → README, full S1–S15 acceptance, FR sweep

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The five-step read contract (contracts/server-actions.md) is spelled out in T008 — reviewers check the steps appear in order; `requireSession()` runs on EVERY `fetchTasks` invocation even though the page is guarded (F002 rule 4)
- `userId` is never accepted from the client and never appears in any DTO or criteria payload; no raw Prisma objects cross the boundary (data-model invariants 1–2; D1)
- A present `categoryId` resolves against owned categories BEFORE any task query — foreign, unknown, and just-deleted ids are one indistinguishable field error, and the client self-heals by dropping the criterion (D4, invariant 10)
- Search matches literally: only the escaped token reaches `contains` — `%`, `_`, quotes, and emoji never alter pattern semantics (D3, invariant 6); overdue and due windows are derived from UTC `now` at query time, never stored (invariant 5)
- Sorts always tie off newest-first; undated tasks sort last under due-date ordering (FR-007)
- E2E cross-user scenarios use request interception; the scale check uses a seeded 100+ task list — never timing sleeps (D8)
- Zero schema changes, zero new dependencies, zero new env vars (D9)
- Commit after each task or logical group; stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence







# Tasks: Dashboard Statistics (F006)

**Input**: Design documents from `/specs/006-dashboard-statistics/`

**Prerequisites**: plan.md (required), spec.md (required), research.md (D1–D7), data-model.md, contracts/server-actions.md, contracts/routes-and-surfaces.md, quickstart.md

**Tests**: INCLUDED — FR-013 mandates automated tests at every layer (unit, component, E2E, security); test-first pairs follow the F005 convention (write the failing test, then implement).

**Organization**: Tasks grouped by user story (US1 urgent counts P1 → US2 priority P1 → US3 recent P2 → US4 jumps P2), plus the FR-014 wiring in Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths included in every description

## Path Conventions

Web app per plan.md — `src/app/(protected)/dashboard/`, `src/components/dashboard/`, `src/server/actions/`, `src/lib/`, `tests/` (Vitest + RTL co-located `*.test.tsx`, Playwright under `tests/e2e/`). The repo is docs-only at planning time; paths are against the F001–F005 planned tree (ADD/EXTEND convention).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: DTO surface and the only new input primitive, all per research D1/D4

- [ ] T001 [P] Create the `DashboardData` DTO types in src/lib/dashboard-dto.ts exactly per research D4: `overdueCount: number`, `dueTodayCount: number`, `priorityDistribution: { LOW; MEDIUM; HIGH }`, `openTaskTotal: number`, `recentTasks: Array<{ id, title, status, priority, dueDate: string | null, updatedAt: string }>` (≤ 5), `generatedAt: string` — all serializable primitives/ISO-8601 strings, no Prisma types, no `Date` instances (data-model invariant 2)
- [ ] T002 [P] Create the timezone-hint primitive in src/lib/timezone.ts: `validateTimezoneHint(hint?: string): string` — absent/undefined ⇒ `"UTC"`; a present hint is valid only if `new Intl.DateTimeFormat("en-US", { timeZone: value })` does not throw (research D1); invalid ⇒ `"UTC"` fallback; add `startOfLocalDay(zone, now)` returning the zone's calendar-day start as a UTC instant (used by both overdue and due-today windows)
- [ ] T003 [P] Unit tests for src/lib/timezone.ts in src/lib/timezone.test.ts: valid IANA zones pass through; `"Not/AZone"`, `""`, and `undefined` all resolve to `"UTC"`; `startOfLocalDay("Asia/Tokyo", new Date("2026-02-28T20:30:00Z"))` = `2026-02-28T15:00:00.000Z` and `startOfLocalDay("UTC", …)` = `2026-02-28T00:00:00.000Z` (the data-model worked-example instants)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The statistics engine and the five-step read action — every user story renders from these

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Write FAILING unit tests for the statistics engine in src/lib/statistics.test.ts per research D7/data-model: overdue = `dueDate < startOfLocalDay(zone, now)` AND `status != COMPLETED`; due-today = `[startOfLocalDay, +1 day)` AND `status != COMPLETED`; completed tasks never overdue; `dueDate: null` excluded from both dated views; distribution counts open tasks only and is date-free; recent = `updatedAt` desc with `id` asc tie-break, capped at 5, completed tasks INCLUDED; include the two midnight-boundary matrix cases verbatim from data-model.md (Case 1 `now=2026-02-28T20:30Z` + `Asia/Tokyo`: due 2026-02-28 ⇒ overdue locally / due-today on the UTC list, due 2026-03-01 ⇒ due-today locally / tomorrow on the list; Case 2 reverse with `America/New_York`) and the same-day agreement assertions (SC-002); `now` is always injected — never wall-clock
- [ ] T005 Implement the pure `computeStatistics` engine in src/lib/statistics.ts so T004 passes: signature `computeStatistics(input: { counts + recent projection, localDayStart: Date, now: Date }): DashboardData` per research D3 — pure, no Next.js/Prisma imports, single source of truth for the overdue/due-today/priority/recent definitions
- [ ] T006 [P] Write FAILING tests for the read action in src/server/actions/dashboard.test.ts per contracts/server-actions.md: calls `requireSession()` on every invocation (F002 rule 4); every query scoped `userId = session.user.id` (FR-005) with the D2 query shapes (overdue `count`, due-today `count`, priority `groupBy` + open-total `count`, recent `findMany({ take: 5, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] })`, summary-field projections only); hint normalized via `validateTimezoneHint` — garbage hint must NOT change the user scope or throw; result is a `DashboardData` DTO with `generatedAt` = the action's `now`; DB errors surface as the F001 generic friendly error, never raw details
- [ ] T007 Implement `fetchDashboardData(input?: { timeZoneHint?: string })` in src/server/actions/dashboard.ts following the five-step contract (validate → `requireSession()` → authorize-by-scope → execute D2 queries + `computeStatistics` → return DTO) so T006 passes; all queries index-backed per data-model (`userId` leading; `status`/`priority`/`dueDate` filters)
- [ ] T008 Create the `/dashboard` route shell in src/app/(protected)/dashboard/page.tsx: protected Server Component (guard inherited from the `(protected)` layout); calls `fetchDashboardData` once per view (interaction rule 1 — all numbers from one `now`); reads the timezone hint per D1 and renders the summary sections with Suspense/loading fallback per F001 shell conventions; component placeholders only (stories wire the real surfaces)

**Checkpoint**: `computeStatistics` green (incl. midnight matrix), action green, `/dashboard` renders with stub data — user story implementation can begin

---

## Phase 3: User Story 1 — Urgent Task Counts (Priority: P1) 🎯 MVP

**Goal**: Overdue and due-today summary cards with honest counts, calm empty states, and no-dead-links zero handling (spec US1, FR-001/FR-002/FR-004, SC-004)

**Independent Test**: Seed fixtures T1–T6 (quickstart) → overdue card shows exactly 2, due-today exactly 1; complete T1 → overdue 1; clear fixtures → calm empty states, never errors. S1–S4.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T009 [P] [US1] Write FAILING RTL component tests for both summary cards in src/components/dashboard/overdue-summary.test.tsx and src/components/dashboard/due-today-summary.test.tsx: count rendered with its meaning ("2 tasks are overdue" / accessible name includes count + label); zero renders the calm empty state with a suggested next action (FR-004) and is NOT a link/focusable (FR-008); status never conveyed by color alone (Principle V)

### Implementation for User Story 1

- [ ] T010 [US1] Implement the shared summary-card primitives in src/components/dashboard/summary-card.tsx (semantic `section` + heading, `aria-label` with count and meaning, zero ⇒ static text + `aria-disabled` + explanatory label per routes-and-surfaces.md jump table) so T009 passes
- [ ] T011 [P] [US1] Implement the overdue summary in src/components/dashboard/overdue-summary.tsx consuming `DashboardData.overdueCount`
- [ ] T012 [P] [US1] Implement the due-today summary in src/components/dashboard/due-today-summary.tsx consuming `DashboardData.dueTodayCount`
- [ ] T013 [US1] Wire both summaries into the top of src/app/(protected)/dashboard/page.tsx above the fold (SC-006) with per-summary empty states (FR-004); verify quickstart S1–S4 manually

**Checkpoint**: US1 independently demoable — counts, empty states, and completed/no-due-date exclusions correct without any other story

---

## Phase 4: User Story 2 — Priority Distribution (Priority: P1)

**Goal**: Open-only Low/Medium/High distribution + open total (spec US2, FR-007 — explicitly date-free)

**Independent Test**: Seed one open task per priority + one completed HIGH → distribution shows exactly the three open counts, open total = 3, the completed HIGH invisible (S5). Complete everything → zeros/empty state, no errors (S6).

### Tests for User Story 2 ⚠️

- [ ] T014 [P] [US2] Write FAILING RTL component tests in src/components/dashboard/priority-distribution.test.tsx: exact per-priority counts rendered with text labels (never color-only — Principle V); open total shown; completed tasks excluded (US2 S2); all-zero renders a clear empty state with next action, not an error (US2 S3)

### Implementation for User Story 2

- [ ] T015 [US2] Implement the priority distribution in src/components/dashboard/priority-distribution.tsx consuming `DashboardData.priorityDistribution` + `openTaskTotal` (Low/Medium/High rows, text/icon + color, counts with meaning in accessible names) so T014 passes
- [ ] T016 [US2] Wire the distribution into src/app/(protected)/dashboard/page.tsx below the urgent summaries; verify quickstart S5–S6

**Checkpoint**: US2 independently demoable; distribution identical across all timezone hints (date-free per FR-007)

---

## Phase 5: User Story 3 — Recent Tasks (Priority: P2)

**Goal**: The five most recently updated tasks with required fields, truncation, and the welcoming first-run state (spec US3, FR-003/FR-004/FR-009, SC-007)

**Independent Test**: Edit T5 then T1 → T1 first; each item shows title/status/priority/due date; 200-char title truncates without layout break (S7); User A never sees User B's items (S8); no tasks at all → "create your first task" state (S4/FR-004).

### Tests for User Story 3 ⚠️

- [ ] T017 [P] [US3] Write FAILING RTL component tests in src/components/dashboard/recent-tasks.test.tsx: ordering = `updatedAt` desc with stable `id`-asc tie-break (spec edge case); each item renders title, status, priority, due date (or "No due date"); items are links to the task list — the dashboard itself offers NO task actions (FR-009); long titles truncate with ellipsis and layout intact (SC-007); empty recent ⇒ welcoming create-first-task state, never an error (FR-004)

### Implementation for User Story 3

- [ ] T018 [US3] Implement the recent list in src/components/dashboard/recent-tasks.tsx consuming `DashboardData.recentTasks` + a "View all tasks" link below (FR-009), with the long-title truncation CSS from routes-and-surfaces.md surfaces table so T017 passes
- [ ] T019 [US3] Wire the recent list into src/app/(protected)/dashboard/page.tsx; verify quickstart S7–S8 manually (S8 also automated in T026)

**Checkpoint**: US3 independently demoable — the dashboard is now a complete read-only overview

---

## Phase 6: User Story 4 — Summary-to-List Navigation (Priority: P2)

**Goal**: Clickable summaries jump to the task list pre-filtered via the one-shot `?seed=` param (spec US4, FR-008/FR-010; research D5)

**Independent Test**: overdue=2 → click → list opens with the Overdue preset active (S9); due-today jump → Due-today preset (S10); HIGH count → priority filter (S11); zero counts render static text (S12); seed stripped on mount, garbage seed ⇒ defaults (S13).

**Depends on**: F005's list container and `taskFilterSchema` (EXTEND, never rewrite)

### Tests for User Story 4 ⚠️

- [ ] T020 [P] [US4] Write FAILING tests for the seed codec in src/lib/dashboard-seed.test.ts: encode/decode round-trips `{ dueDate: "OVERDUE" }`, `{ dueDate: "DUE_TODAY" }`, `{ priority: "HIGH" | "MEDIUM" | "LOW" }` as base64url JSON; malformed base64, non-JSON, unknown enum values, and extra fields are ALL rejected by `taskFilterSchema` validation (FR-010) and normalize to `null`/defaults

### Implementation for User Story 4

- [ ] T021 [US4] Implement the seed codec in src/lib/dashboard-seed.ts (encode/validate through the shared `taskFilterSchema` per D5) so T020 passes
- [ ] T022 [P] [US4] Make non-zero summaries clickable in src/components/dashboard/summary-card.tsx + overdue-summary.tsx + due-today-summary.tsx + priority-distribution.tsx: `Link` to `/?seed=<encoded>` using the D5 seed mapping (overdue → `OVERDUE`, due-today → `DUE_TODAY`, priority → its enum); accessible label states it opens "the task list's overdue/due-today view" (boundary honesty, S17); zero-count cards remain non-interactive static text (FR-008)
- [ ] T023 [US4] Consume `?seed=` in the F005 list page container (src/app/(protected)/page.tsx or the list container component per F005's actual structure — EXTEND only): read once server-side, decode+validate via the codec, hydrate as the initial view, then `router.replace` to strip the param on mount; reload/back-forward and `?seed=<garbage>` all yield defaults (S13); landed filter visible and resettable in the F005 filter bar
- [ ] T024 [P] [US4] Write FAILING Playwright E2E for the jump flows in tests/e2e/dashboard-jumps.spec.ts covering S9–S13 (including the zero-count not clickable/not focusable and seed-stripping assertions) and make it pass against T021–T023

**Checkpoint**: US4 independently demoable — every non-zero summary navigates, seeds are one-shot and schema-validated

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: FR-014 wiring, cross-story quality gates, full quickstart validation

- [ ] T025 [P] Amend the sign-in default destination to `/dashboard` in the auth redirect logic (the F002 constant where absent `?next=` currently defaults to the task list — one constant per the FR-014 diff in routes-and-surfaces.md); keep explicit `?next`/open-redirect posture and both guards byte-identical to F002's contract; add the Dashboard nav link to the shared protected nav in src/components/layout/ per F005's nav structure
- [ ] T026 Write the FAILING Playwright security test in tests/e2e/dashboard-security.spec.ts (S8/SC-003): User A and User B each see only their own numbers; no user id ever sent from the browser (assert request bodies/params contain none) — then confirm T007's scoping already satisfies it
- [ ] T027 Write the FAILING Playwright landing test in tests/e2e/dashboard-landing.spec.ts (S14): sign-in without `?next=` lands on `/dashboard`; visiting `/dashboard` signed-out returns to it after sign-in; captured `?next` deep links still honored
- [ ] T028 [P] Responsive + a11y pass on all dashboard components (FR-011, Principle V, SC-006): summaries stack at 320 px / grid at desktop, no horizontal scrolling; keyboard-only traversal with visible focus; both themes; axe-clean headings/labels
- [ ] T029 Performance verification (SC-001/FR-012): seed 150 tasks, confirm the dashboard renders well under 2 s with the D2 index-backed queries; add/adjust indexes if the EXPLAIN plan shows scans
- [ ] T030 Run the full quickstart.md S1–S20 validation; confirm S15–S17 (midnight matrix) pass as automated tests; all suites green (Vitest unit + RTL + Playwright); mark checklist items done

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T003 all independent — start immediately
- **Foundational (Phase 2)**: T004 before T005 (test-first pair); T006 before T007; T008 depends on T007; T004∥T006
- **US1 (Phase 3)**: T009 → T010 → T011∥T012 → T013
- **US2 (Phase 4)**: T014 → T015 → T016 (independent of US1 except the shared page wiring)
- **US3 (Phase 5)**: T017 → T018 → T019
- **US4 (Phase 6)**: T020 → T021 → T022/T023 → T024; EXTENDS F005's list — never change F005 behavior for non-seed URLs
- **Polish (Phase 7)**: T025–T029 largely parallel; T030 last (full validation)

### User Story Dependencies

- **US1 (P1)**: Foundational only — no other story needed
- **US2 (P1)**: Foundational only; shares only the page file with US1 (coordinate wiring edits)
- **US3 (P2)**: Foundational only
- **US4 (P2)**: Foundational + F005's list container and `taskFilterSchema`; card jump wiring (T022) depends on US1/US2 components existing

### Parallel Opportunities

- Phase 1: T001, T002, T003 all parallel (different files)
- Phase 2: T004∥T006 (test files, then their implementations in order)
- Component tests T009/T014/T017/T020 in different files — parallelizable across stories
- T022, T024–T028 can run together once their prerequisites land

---

## Parallel Example: User Story 1

```bash
# After Foundational:
Task: "T009 RTL tests for overdue + due-today summaries (2 files)"
# Then in parallel:
Task: "T011 overdue-summary.tsx"  ∥  Task: "T012 due-today-summary.tsx"
# Finally sequential: T010 shared card → T013 page wiring
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2 (DTO, timezone, engine, action, shell)
2. Phase 3 (US1) → **STOP and VALIDATE** quickstart S1–S4
3. Deploy/demo — urgent counts alone deliver the P1 core value

### Incremental Delivery

- +US2 (priority distribution) → validate S5–S6
- +US3 (recent tasks) → validate S7–S8 — dashboard feature-complete read-only
- +US4 (jumps) + Polish (landing, security, a11y, perf) → validate S9–S20

### Parallel Team Strategy

With multiple developers after the Foundational checkpoint:
- Developer A: US1 → US2 (shared page file — coordinate T013/T016/T019 wiring)
- Developer B: US4 codec (T020/T021) then jump wiring
- Developer C: Polish tests (T026/T027) once the action exists

## Notes

- [P] tasks = different files, no dependencies
- Every story is independently testable from the Foundational checkpoint onward
- Commit after each task or logical group; stop at any checkpoint to validate
- Avoid: editing F005 list behavior beyond the seed consumer (T023); duplicating overdue/due-today logic outside `computeStatistics` (single source of truth per data-model)
- Inject `now` everywhere in tests — never wall-clock (research D7)
---
description: "Task list for F003 Task Management"
---

# Tasks: Task Management (F003)

**Input**: Design documents from `/specs/003-task-management/`

**Prerequisites**: plan.md ✅, spec.md ✅ (post-clarify), research.md ✅ (13 decisions D1–D13), data-model.md ✅, contracts/ ✅ (server-actions, routes-and-surfaces), quickstart.md ✅ (S1–S12)

**Tests**: Included — constitution IV mandates unit/component/E2E gates; D12 pins the strategy (pure-rule matrix tests including calendar-boundary overdue cases; E2E optimistic-rollback via request interception; double-submit via scripted rapid clicks — never timing sleeps).

**Organization**: Grouped by user story — US1 Create a Task (P1), US2 View My Tasks (P1), US3 Complete and Reopen Tasks (P1), US4 Edit a Task (P2), US5 Delete a Task (P2). Action shapes per `contracts/server-actions.md`; page/read/surface semantics per `contracts/routes-and-surfaces.md`; the `Task` entity, transition matrix, and invariants per `data-model.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

## Path Conventions

Single full-stack Next.js project extending F001+F002 in place (plan.md): `src/` + `tests/` at repository root; Prisma confined to `src/server/`; shared Zod schemas in `src/validation/`; pure rule functions in `src/server/tasks/`; feature UI in `src/features/tasks/`. The task list lives at `/` — `src/app/(protected)/page.tsx` becomes the list page; F003 adds NO routes (contracts/routes-and-surfaces.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch, the first per-user business data model, and its migration — no new dependencies, no env changes (D7, D13).

- [X] T001 Confirm the F002 foundation is complete and all its quality gates are green (`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run test:e2e`), then create and switch to branch `003-task-management` (if no git repo exists yet, first execute F001 T001 — `.gitignore` before any commit)
- [X] T002 [P] Extend `prisma/schema.prisma` with the `Task` model exactly per data-model.md: `id String @id @default(cuid())`, `userId String`, `title String`, `description String?`, `status TaskStatus @default(TODO)`, `priority TaskPriority @default(MEDIUM)`, `dueDate DateTime? @db.Date`, `categoryId String?` (reserved scalar — NO relation, D11), `createdAt/updatedAt`, enums `TaskStatus { TODO IN_PROGRESS COMPLETED }` and `TaskPriority { LOW MEDIUM HIGH }`, relation `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`, and the ONE adopted index `@@index([userId, createdAt(sort: Desc)])` (D6 — all other index candidates deferred with recorded reasons)
- [X] T003 Create and apply the migration `npx prisma migrate dev --name task_management`; verify the `tasks` table, both enums, the composite `(userId, createdAt DESC)` index, and the cascade FK exist in the dev database (D6, D11; depends on T002)

**Checkpoint**: Branch `003-task-management`; `tasks` table live with the single adopted index; zero new dependencies and zero new env vars (D13).

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation, the pure status/overdue rules, and the scoped task service every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Write the failing unit tests for the shared task schemas in `tests/unit/task-schema.test.ts` (D1, D2, D12): `title` required, 1–120 characters after trimming; `description` optional, ≤1000 characters, empty → `null`; `dueDate` optional, strict `YYYY-MM-DD` → UTC-midnight `Date` (malformed and impossible dates like `2026-02-30` rejected); `priority` enum with default `MEDIUM`; `status` enum with default `TODO` — `createTaskSchema` accepts any valid initial status (clarified FR-001); `updateTaskSchema` re-uses the same field rules; `taskIdSchema` non-empty string
- [X] T005 [P] Write the failing unit tests for the pure rules in `tests/unit/task-rules.test.ts` (D1, D2, D12): `validateTransition` covers the FULL 3×3 matrix — allowed: TODO→IN_PROGRESS, TODO→COMPLETED (direct completion, US3 S1/quickstart S6), IN_PROGRESS→COMPLETED, COMPLETED→TODO (reopen), and every same-status no-op; rejected: IN_PROGRESS→TODO and COMPLETED→IN_PROGRESS with a field-level `status` message; `isOverdue` covers due yesterday/today/tomorrow, month and year boundaries (Dec 31 → Jan 1), `null` dueDate, and completed tasks never overdue — calendar-day comparison, never `Date.now()` arithmetic inside render
- [X] T006 Create `src/validation/task-schema.ts` making T004 pass: `createTaskSchema`, `updateTaskSchema`, `taskIdSchema` — the single Zod source of truth shared by client and server (constitution II; D2)
- [X] T007 Create `src/server/tasks/rules.ts` making T005 pass: `validateTransition(from, to)` and `isOverdue(dueDate, status, today)` — pure functions with NO Prisma/React imports, consumed by BOTH the client (inline edit feedback) and the server (authoritative enforcement) (D1, D2)
- [X] T008 [P] Write the failing unit tests for the task service with a mocked Prisma client in `tests/unit/task-service.test.ts` (D4, D9, D10, D12): every read/write is scoped `where { userId }`; the list selects ONLY UI fields ordered `createdAt desc`; mutations map to `TaskDto` — no raw Prisma objects ever cross the boundary and no `userId` field in the DTO; unknown id, another user's id, and already-deleted id return the SAME indistinguishable friendly failure (no existence leak); delete uses `deleteMany` + affected-count check
- [X] T009 Create `src/server/tasks/service.ts` making T008 pass: `listTasks(userId)`, `createTask(userId, input)`, `updateTask(userId, id, input)` (loads the scoped row, consults `validateTransition`), `setTaskStatus(userId, id, status)` (same-status no-op → success), `deleteTask(userId, id)` (`deleteMany`; count 0 → friendly failure) (D9, D10; depends on T006, T007)
- [X] T010 Run the quality gates (`npm run typecheck && npm run lint && npm run format:check && npm run test`) and commit the foundational layer

**Checkpoint**: Task substrate ready — shared schemas, pure transition/overdue rules, scoped CRUD service all green; user story implementation can begin.

## Phase 3: User Story 1 — Create a Task (Priority: P1) 🎯 MVP

**Goal**: A signed-in user creates a task with only a title (defaults applied) or with full details including an initial status; invalid submissions show field-level guidance and save nothing; rapid double-submits create at most one task (US1 scenarios 1–4).

**Independent Test**: Create with only a title (saved with TODO/MEDIUM/no due date and shown in the list), then with every field filled (all values saved exactly), then with invalid data (field errors, zero new rows), then double-click the submit button (one task) (quickstart S1–S3 + S11).

### Tests for User Story 1 (write FIRST, keep failing until the implementation lands)

- [X] T011 [P] [US1] Write the failing component tests for TaskForm in `tests/component/TaskForm.test.tsx` (FR-001–FR-003, D12): labeled title/description/due-date/priority/status fields; title-only submit passes `createTaskSchema` with defaults visible (TODO/MEDIUM); invalid submissions render inline field errors (empty/121-char title, 1001-char description, malformed date) and preserve typed input; clearing optional fields submits `null`
- [X] T012 [P] [US1] Write the failing E2E create scenarios in `tests/e2e/tasks.spec.ts` (S1–S3, S11; SC-001): title-only create → success and the task appears (the ≤2 s list assertion completes with US2's list in T017); all-fields create incl. an initial status → exact values; invalid submissions → field-level errors, nothing created; rapid double-click submit → at most one task (scripted rapid clicks — never timing sleeps, D12)

### Implementation for User Story 1

- [X] T013 [US1] Implement the `createTask` server action in `src/server/actions/task-actions.ts` per contracts/server-actions.md — the five steps in order: (1) validate via `createTaskSchema`; (2) `requireSession()`; (3) authorize — own list only, NO client-supplied `userId` accepted; (4) execute via the task service (any valid initial status accepted, clarified FR-001); (5) return the `TaskActionResult` union `{status:"success", task}` | `{status:"validation_error", fieldErrors}` | `{status:"failure", message}` — never a raw DB object — and `revalidatePath("/")` (depends on T006, T009)
- [X] T014 [P] [US1] Create the create-task surface in `src/features/tasks/`: `TaskForm.tsx` client component making T011 pass (`useActionState`, F001 `src/components/ui/` primitives, inline field errors adjacent to fields, pending-gated submit — D8 double-submit prevention), native `<input type="date">` (D1), and the adaptive wrapper — bottom `Sheet` <sm, centered `Dialog` ≥sm (D7; contracts/routes-and-surfaces.md)
- [X] T015 [US1] Add the "New task" control to the protected page shell `src/app/(protected)/page.tsx` (the list body itself stays a placeholder until US2); validate US1 independently: T011/T012 green; quickstart S1–S3 + S11 manual pass; gates green; commit (depends on T013, T014)

**Checkpoint**: Creation works — defaults land, invalid input saves nothing, double-clicks can't duplicate.

## Phase 4: User Story 2 — View My Tasks (Priority: P1)

**Goal**: The signed-in user's home (`/`) lists ONLY their own tasks, newest first, each showing title, status, priority, and due date (when set) at a glance — color-independent, with derived overdue flags and an inviting empty state (US2 scenarios 1–3).

**Independent Test**: A fresh user sees the empty state; tasks render newest-first with every attribute readable with color disabled; a second account sees none of the first account's tasks (quickstart S4–S5).

### Tests for User Story 2 (write FIRST)

- [X] T016 [P] [US2] Write the failing component tests for TaskItem and the empty state in `tests/component/TaskItem.test.tsx`: title, status badge, and priority badge rendered as TEXT badges/labels (+icons), never color alone (FR-005, SC-007); due date rendered when set; overdue flag shown ONLY when the task is past its calendar day and not completed — via the shared `isOverdue` (FR-012, D1); complete/reopen, edit, and delete controls present; empty state offers a clear create-first-task action (FR-013)
- [X] T017 [P] [US2] Write the failing E2E list scenarios in `tests/e2e/tasks.spec.ts`: empty state on a fresh account (S5, FR-013); newest-first ordering after several creates; color-off readability (emulate monochrome/forced-colors — S4, SC-007); two-user privacy — User B's list contains none of User A's tasks (S4, SC-003, FR-004); creates persist across a reload (SC-002); completes US1's deferred "appears within ~2 s" assertion (T012)

### Implementation for User Story 2

- [X] T018 [US2] Implement the list read in `src/app/(protected)/page.tsx` per contracts/routes-and-surfaces.md: ONE scoped query via the task service (`where { userId }`, `orderBy createdAt desc`, UI fields only — `description` included for the edit surface), rows mapped to `TaskDto` before crossing to any client component — Server Component, no client fetch, no raw Prisma objects in props (D4; depends on T009; renders the T019 components)
- [X] T019 [P] [US2] Create `src/features/tasks/TaskList.tsx`, `TaskItem.tsx`, and the empty state making T016 pass — render `TaskDto`s only (D4); text badge/icon affordances per FR-005; the OVERDUE flag driven by `isOverdue` from `src/server/tasks/rules.ts` (depends on T007)
- [X] T020 [US2] Wire the list into the page, replacing US1's placeholder; validate US2 independently: T016/T017 green; quickstart S4–S5 manual pass; SC-002/SC-003/SC-007 verified; gates green; commit (depends on T018, T019)

**Checkpoint**: The home surface is the user's task list — private, newest-first, readable without color, empty state invites creation.

## Phase 5: User Story 3 — Complete and Reopen Tasks (Priority: P1)

**Goal**: One interaction completes a task (from TODO directly or via IN_PROGRESS) with an optimistic UI flip and a silent background write; failures roll back with a friendly error and resync from the server; reopening returns COMPLETED → TODO (US3 scenarios 1–4).

**Independent Test**: Complete a TODO task (badge flips instantly, no reload), reopen it (back to TODO), force a failure (request intercepted → UI rolls back with an error and the server stays consistent), toggle rapidly (ends consistent) (quickstart S6–S7).

### Tests for User Story 3 (write FIRST)

- [ ] T021 [P] [US3] Write the failing component tests for the status toggle in `tests/component/TaskStatusToggle.test.tsx`: optimistic flip on click before the action resolves; failure → rollback + friendly error + resync (FR-009, D3); label reflects the target state (complete vs reopen)
- [ ] T022 [P] [US3] Write the failing E2E toggle scenarios in `tests/e2e/tasks.spec.ts`: complete a TODO task directly (forward skip — US3 S1, clarified lifecycle); reopen COMPLETED → TODO (S6, FR-008); rapid toggling settles consistent; rollback via request interception — abort `setTaskStatus` mid-flight, assert the UI rolled back + an understandable error shows + a reload matches the server state (S7, SC-004, D12)

### Implementation for User Story 3

- [ ] T023 [US3] Implement the `setTaskStatus` server action in `src/server/actions/task-actions.ts` per contracts/server-actions.md — five steps: (1) validate via `taskIdSchema` + `statusSchema`; (2) `requireSession()`; (3) authorize — scoped lookup; foreign/unknown id → the SAME friendly failure (D9); (4) execute — same-status no-op → success; the matrix consulted via the shared `validateTransition`, backward pair → `validation_error` on `status` (D2); (5) return `TaskActionResult` + `revalidatePath("/")` (depends on T007, T009)
- [ ] T024 [US3] Create `src/features/tasks/TaskStatusToggle.tsx` making T021 pass: `useOptimistic` + `useTransition` wired to the action (D3), pending-gated against double-fires (D8), integrated into TaskItem (depends on T021, T023)
- [ ] T025 [US3] Validate US3 independently: T021/T022 green incl. the interception rollback; quickstart S6 (toggle steps — its backward-pick step lands with US4's edit surface, T027/T029) + S7 manual pass; SC-004 verified; gates green; commit

**Checkpoint**: The completion loop is instant and honest — optimistic updates that never lie after a failure.

---

## Phase 6: User Story 4 — Edit a Task (Priority: P2)

**Goal**: The user edits any field via the same adaptive surface (prefilled); clearing optional fields removes them; cancel leaves the task untouched; backward status picks are rejected inline BEFORE submit via the shared rules (US4 scenarios 1–4 + the clarified backward-transition edge).

**Independent Test**: Edit each field and save (persisted), clear description/due date (removed, nothing else changes), cancel an edit (untouched), pick an illegal backward status (inline `status` field error before any save) (quickstart S8 + S6's third step).

### Tests for User Story 4 (write FIRST)

- [ ] T026 [P] [US4] Write the failing component tests for the edit surface in `tests/component/TaskEditSurface.test.tsx`: form prefilled from the `TaskDto`; clearing description/dueDate submits `null` (FR-007); cancel closes with zero mutations (US4 S4); picking IN_PROGRESS→TODO (or COMPLETED→IN_PROGRESS) shows the inline `status` error BEFORE submit — the shared `validateTransition` runs client-side (clarified lifecycle, D2)
- [ ] T027 [P] [US4] Write the failing E2E edit scenarios in `tests/e2e/tasks.spec.ts`: edit every field → persisted (FR-006); clear optional fields → removed without side effects (FR-007); cancel → task unchanged; a backward status submission → server rejects with a `status` field error and the task is unchanged (S6 third step, S8)

### Implementation for User Story 4

- [ ] T028 [US4] Implement the `updateTask` server action in `src/server/actions/task-actions.ts` per contracts/server-actions.md — five steps: (1) validate via `updateTaskSchema` + `taskIdSchema`; (2) `requireSession()`; (3) authorize — scoped load of `{id, userId}`; foreign/unknown/already-deleted id → the SAME friendly failure (D9); (4) execute — `validateTransition(loaded.status, input.status)` stops a backward pair with a `status` field error; cleared optionals persist `null` (FR-007); (5) return `TaskActionResult` + `revalidatePath("/")` (depends on T006, T007, T009)
- [ ] T029 [US4] Create the edit surface making T026 pass: reuse the adaptive Dialog/Sheet wrapper and TaskForm from US1 (T014) in edit mode — prefilled, cancel path, inline transition errors (depends on T026, T028)
- [ ] T030 [US4] Validate US4 independently: T026/T027 green; quickstart S6 (backward-pick step) + S8 manual pass; gates green; commit

**Checkpoint**: Editing is safe — full-field updates, honest clearing, untouched cancels, illegal transitions blocked on both sides.

## Phase 7: User Story 5 — Delete a Task (Priority: P2)

**Goal**: Deletion requires explicit confirmation and is permanent; cancel leaves the task untouched; a stale second-tab delete (foreign/unknown/already-deleted) produces one friendly failure and the list recovers via revalidation (US5 scenarios 1–3).

**Independent Test**: Delete with confirm (gone permanently), delete with cancel (untouched), attempt to delete an already-deleted task from another tab (friendly feedback, no crash, list recovers) (quickstart S9).

### Tests for User Story 5 (write FIRST)

- [ ] T031 [P] [US5] Write the failing component tests for DeleteConfirmDialog in `tests/component/DeleteConfirmDialog.test.tsx`: confirm invokes the `deleteTask` action; cancel closes with zero mutations (FR-010); the dialog is fully keyboard-operable with visible focus (FR-014, D7)
- [ ] T032 [P] [US5] Write the failing E2E delete scenarios in `tests/e2e/tasks.spec.ts`: confirm → task removed permanently (S9, SC-006); cancel → untouched; a stale second-tab delete → friendly failure, no crash, the list recovers after revalidation (FR-011, D12)

### Implementation for User Story 5

- [ ] T033 [US5] Implement the `deleteTask` server action in `src/server/actions/task-actions.ts` per contracts/server-actions.md — five steps: (1) validate via `taskIdSchema`; (2) `requireSession()`; (3) authorize — ownership IS the scoping; (4) execute — scoped `deleteMany { id, userId }` (D10); affected count 0 → the SAME friendly failure (D9); (5) return `TaskActionResult` + `revalidatePath("/")` (depends on T009)
- [ ] T034 [US5] Create `src/features/tasks/DeleteConfirmDialog.tsx` (shadcn/ui AlertDialog, D7) and wire the delete control into TaskItem making T031 pass; rapid repeat clicks must not double-open the dialog or double-submit (D8; US1 S4 pattern) (depends on T031, T033)
- [ ] T035 [US5] Validate US5 independently: T031/T032 green; quickstart S9 manual pass; gates green; commit

**Checkpoint**: Deletion is deliberate and honest — confirmed, permanent, stale-safe.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final compliance sweep and full-acceptance validation of the whole feature.

- [ ] T036 [P] Update `README.md`: refresh the data-model section for the `task_management` migration, add a "Task Management" subsection under key architectural decisions (pure shared transition/overdue rules — D1/D2; DTO-only server boundary — D4; optimistic toggles with rollback — D3; scoped `deleteMany` deletion — D10), and note that F003 added no new dependencies and no new env vars (D7, D13)
- [ ] T037 Run the FR/SC acceptance sweep: execute the full quickstart.md S1–S12 manually (incl. S10 overdue calendar boundaries and S12 keyboard/responsive matrix across 320–1280 px with a seeded 100-task list — SC-005, SC-008), verify persistence across sessions incl. edits (SC-002), run every automated gate (`npm run typecheck && npm run lint && npm run format:check && npm run test && npm run test:e2e`), confirm no raw Prisma objects cross the server/client boundary and no task content or internals appear in any error or log (D4, D9; data-model invariants), and commit the completed feature on `003-task-management`

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first (branch); T002 parallel; T003 depends on T002
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. Test-before-impl pairs: T004→T006, T005→T007, T008→T009; T010 last (gates + commit)
- **US1 (Phase 3)**: Depends on Phase 2; T011/T012 first (failing), then T013∥T014, then T015
- **US2 (Phase 4)**: Depends on US1 (the page shell and created content it renders); T016/T017 first, then T018∥T019, then T020
- **US3 (Phase 5)**: Depends on US2 (the toggle lives inside TaskItem); T021/T022 first, then T023 → T024 → T025
- **US4 (Phase 6)**: Depends on US1 (the reused TaskForm/adaptive surface) and US2 (the edit control on TaskItem); T026/T027 first, then T028 → T029 → T030
- **US5 (Phase 7)**: Depends on US2 (the delete control on TaskItem) and US1 (list content); T031/T032 first, then T033 → T034 → T035
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1 → US2 → US3 → US4 → US5** in spec priority order: each story is independently testable at its own layer once its predecessors land — US1's full "appears in the list within ~2 s" browser assertion lands with US2's list (T017), the backward-rejection E2E with US4 (S6's third step), and the stale-delete feedback with US5
- **US4/US5 (P2)**: additive surfaces over the completed P1 slice; nothing in them reworks earlier stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- The server action (five-step contract) before the client surface that calls it
- Core implementation before the story's independent validation task
- Story complete before moving to the next priority

### Parallel Opportunities

- Phase 1: T002 [P]; Phase 2: T004, T005, T008 all [P] (different test files)
- Within stories: T011+T012 (US1), T016+T017 (US2), T021+T022 (US3), T026+T027 (US4), T031+T032 (US5) — independent test-first files; T013∥T014 (US1) and T018∥T019 (US2) split action/page vs components; T036 [P] in Polish
- The stories form one vertical slice through shared files (`task-actions.ts`, `TaskItem.tsx`), so cross-story parallelism is intentionally limited; a second developer can take the next story's test-first files while the current story's implementation is reviewed — no same-file conflicts

---

## Parallel Example: User Story 2

```bash
# Launch the two independent test files together (write first, keep failing):
Task: "Component tests for TaskItem + empty state in tests/component/TaskItem.test.tsx"
Task: "E2E list scenarios in tests/e2e/tasks.spec.ts"

# After the read contract lands, page read and components split:
Task: "List read in src/app/(protected)/page.tsx (Server Component, scoped query → TaskDto)"
Task: "TaskList/TaskItem/empty state in src/features/tasks/"
```

---

## Implementation Strategy

### MVP First (User Stories 1–2)

1. Complete Phase 1: Setup → 2. Phase 2: Foundational → 3. Phases 3–4: US1+US2
4. **STOP and VALIDATE** (quickstart S1–S5, S11) — a user can create tasks and see their list

### Incremental Delivery

1. Setup + Foundational → task substrate (shared schemas, pure rules, scoped service)
2. US1 → the capture step of the core loop (MVP!)
3. US2 → the list becomes the home surface
4. US3 → the optimistic completion loop
5. US4 → safe full-field editing
6. US5 → confirmed, stale-safe deletion
7. Polish → README, full S1–S12 acceptance, FR sweep

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The five-step server-action contract (contracts/server-actions.md) is spelled out in T013, T023, T028, and T033 — reviewers check the steps appear in order
- `userId` is never accepted from the client and never appears in any `TaskDto`; no raw Prisma objects cross the server/client boundary (data-model invariants; D4, D9)
- Backward transitions are rejected with a field-level `status` error on BOTH sides via the ONE shared `validateTransition` (D2); same-status no-ops are successes
- Overdue is always derived at render from the calendar day — never stored, never computed with `Date.now()` inside render (D1)
- E2E rollback uses request interception; double-submit uses scripted rapid clicks — never timing sleeps (D12)
- Commit after each task or logical group; stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence

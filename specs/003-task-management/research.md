# Research: Task Management (F003)

**Feature**: `003-task-management` | **Date**: 2026-09-16 | **Status**: Complete — no NEEDS CLARIFICATION items remain

The spec's two clarifications (forward-only lifecycle; calendar-day due dates) are pinned inputs, not research questions. The stack is fixed by the constitution; research below resolves the open *implementation design* decisions. F001's decisions (npm, Node 22, tooling, Vitest/RTL/Playwright) and F002's decisions (Auth.js + DB-backed sessions, `requireSession()`, five-step action contract, scrypt) are inherited and not re-litigated.

## D1: Due dates — PostgreSQL `DATE` column, UTC-midnight normalization, calendar-day overdue

- **Decision**: `dueDate` is an optional `DateTime @db.Date` (PostgreSQL `DATE` — no time-of-day is representable). Input uses the native `<input type="date">` (date-only, zero dependencies); the wire format is a `YYYY-MM-DD` string validated by the shared Zod schema and normalized once at the action boundary to a UTC-midnight `Date`. Overdue is **derived, never stored**: a pure `isOverdue(dueDate, today)` compares calendar days (both normalized to UTC midnight) — `overdue = dueDate !== null && status !== "COMPLETED" && dueDate < today` — evaluated at read/render time by the Server Component.
- **Rationale**: `@db.Date` makes "a calendar day without time-of-day" a type-level guarantee and rules out clock-time comparisons by construction, satisfying clarified FR-001/FR-012. Deriving overdue at render keeps it correct as "today" advances with zero writes and no staleness (no cron, no stored flag). A pure function makes the calendar-day rule unit-testable across month/year boundaries.
- **Alternatives considered**: (a) `DateTime` with a time component — rejected: reintroduces clock-time semantics the clarification excludes. (b) A stored `isOverdue` flag — rejected: stale by design; the comparison is cheaper than keeping it fresh. (c) `YYYY-MM-DD` string in the DB — rejected: loses the DB date type, range checks, and indexability. (d) Per-user-timezone calendar evaluation — rejected: F003 has no user-timezone concept; UTC-calendar-day is deterministic and documented; tz-awareness is a later-feature concern.

## D2: Forward-only lifecycle — one shared pure transition rule

- **Decision**: A pure function `validateTransition(from, to)` encodes the exact matrix (see data-model.md "Status lifecycle") and lives with the task service. Allowed after creation: `TODO → IN_PROGRESS`, `IN_PROGRESS → COMPLETED`, `TODO → COMPLETED` (complete directly — US3 scenario 1 requires completing from TODO in a single interaction), `COMPLETED → TODO` (reopen, the sanctioned reset), and same-status no-ops (an unchanged edit must not error). Rejected: every backward pair (`IN_PROGRESS → TODO`, `COMPLETED → IN_PROGRESS`, and any other non-listed move) with a field-level error on `status` — the task is left unchanged. The shared Zod schemas validate enum *shape* on create and update; the *transition* check runs against the loaded task's current status in the action (authoritative server-side) and is invoked by the edit form client-side against the known current status — one source of truth for the rule (constitution II). Creation is exempt: any valid status may be initially set (clarification #1).
- **Rationale**: "Forward-only" must not silently break US3 scenario 1 ("a task in TODO or IN_PROGRESS … completes it"), so the operative reading is *no backward moves, forward skips allowed, reopen resets to TODO* — exactly the pairs the spec's edge case lists as rejected (`IN_PROGRESS → TODO`, `COMPLETED → IN_PROGRESS`). Three transitions as explicit pairs need no state-machine library (constitution III); sharing the pure function client/server prevents the classic drift where the client allows what the server rejects.
- **Alternatives considered**: (a) Encoding the rule as a Zod `.refine` — rejected: the schema cannot know the current DB status, so the rule would be split in two anyway. (b) DB trigger/check constraint — rejected: hides business logic from types and tests; overkill. (c) Status-rank arithmetic (compare ordinals) — rejected: breaks the moment a future status is added; explicit pairs are self-documenting.

## D3: Optimistic complete/reopen with guaranteed rollback

- **Decision**: The status toggle (complete on TODO/IN_PROGRESS; reopen on COMPLETED) uses React 19's native `useOptimistic` + `useTransition` — no library. The server action `setTaskStatus` returns the predictable result; on failure the component shows a friendly error and calls `router.refresh()` to resync — the optimistic value is discarded when the transition ends (FR-009 exactly). Rapid toggling (US3 scenario 4) settles correctly: the action is the last writer and the post-settle refresh reconciles display to server state.
- **Rationale**: Constitution V names "completing a task, toggling status" as the sanctioned optimistic case and mandates rollback + consistency; native React primitives deliver it with zero dependencies. Reopen→TODO is simply the `COMPLETED → TODO` transition (D2) via the same action.
- **Alternatives considered**: (a) No optimistic update (await + revalidate) — rejected: contradicts constitution V's explicit UX requirement for completion toggles. (b) A client data/state library — rejected: new runtime dependency for what `useOptimistic` + `revalidatePath` already cover (YAGNI).

## D4: List architecture — Server Component read, `revalidatePath` writes, mapped DTOs

- **Decision**: The protected page renders the task list as a Server Component: one query per render — `task.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: <UI fields only> })`. The `select` covers exactly what the UI needs for row display *and* the edit surface (id, title, description, status, priority, dueDate, createdAt — description is required by the edit form, so it is a UI-required field). Mutation actions call `revalidatePath` server-side after a successful write. Rows map to a plain `TaskDto` before crossing to any client component (never a raw Prisma object).
- **Rationale**: Server-rendered by default (constitution III); one read path makes the ownership scope (`where: { userId }`) trivially auditable; field selection satisfies "fetch only the fields required by the UI"; `revalidatePath` is the native Next.js mechanism — no cache library needed.
- **Alternatives considered**: (a) Client-side fetching with a data library — rejected: violates the server-default constraint and adds a dependency. (b) A separate query when the edit surface opens — rejected: an extra round trip for data the row already passes to the dialog (YAGNI; both are UI-required fields).

## D5: Ordering, scale, and pagination posture

- **Decision**: `orderBy: createdAt desc` (newest-first, spec assumption). No pagination, virtualization, or infinite scroll in F003: SC-005's 100-task bar is comfortably met by a single indexed query rendering 100 lightweight rows; the compound index (D6) keeps the read efficient per user. Search/filter/sort are explicitly later features (spec Assumptions) and will revisit this posture.
- **Rationale**: YAGNI (constitution III) — pagination before a demonstrated need is premature complexity; 100 Server-Rendered rows are trivially within budget.
- **Alternatives considered**: (a) Immediate pagination at 50 — rejected: no requirement; adds page controls and offset queries now. (b) A virtualized list — rejected: client-side JS weight for no measured need at 100 items.

## D6: Index evaluation (constitution-mandated)

- **Decision**: Adopt **one** compound index: `@@index([userId, createdAt(sort: Desc)])` — it is the *actual* F003 query pattern (the list read: filter by user, sort newest-first) and covers it without a filesort. Constitution-named candidates are evaluated and **deferred with reasons**: `status`, `priority`, `dueDate` single-column indexes — no F003 query filters on them (search/filter/sort are later features); `categoryId` index and FK — no category queries exist until the categories feature adds them. Each deferral is re-evaluated the moment its query pattern lands.
- **Rationale**: The constitution requires evaluation, not accretion: indexes without queries are pure write cost. One compound index exactly matches the one read pattern F003 has.
- **Alternatives considered**: (a) Index every constitution-named column now — rejected: speculative; write amplification with no reader. (b) No index beyond the FK — rejected: the `createdAt desc` sort over an unindexed per-user set degenerates as the list grows; the compound index is one line now.

## D7: Surfaces — shadcn/ui Dialog + Sheet + AlertDialog (copy-in components)

- **Decision**: Create/edit uses a shadcn/ui **Dialog** on desktop (≥sm) and a **Sheet** anchored to the bottom on mobile (<sm) — constitution V's exact requirement. Delete uses a shadcn/ui **AlertDialog** for explicit confirmation (FR-010). These are copy-in components under the constitution's sanctioned "shadcn/ui design conventions"; their Radix dialog/sheet/alert-dialog primitives are the only added runtime surface, justified here once. The date field is the native `<input type="date">` (D1); all controls are keyboard-operable with visible focus, labeled fields, and inline errors near fields (FR-014).
- **Rationale**: Constitution V prescribes modal-on-desktop/bottom-sheet-on-mobile and full dialog a11y; hand-rolling focus traps, scroll locking, and aria wiring to that bar is exactly the "unnecessary work" the no-unnecessary-libraries rule exists to prevent. Radix primitives are accessible by default and are the standard substrate *of* shadcn/ui — treating them as outside the sanctioned conventions would make the sanctioned convention unusable.
- **Alternatives considered**: (a) A hand-styled native `<dialog>` — rejected: focus trap, escape/scroll-lock, and mobile sheet semantics all hand-maintained; a11y regressions likely against constitution V's bar. (b) Full shadcn/ui init with a dozen components — rejected: copy in only Dialog, Sheet, AlertDialog plus the minimal button/field primitives established by F001/F002 conventions.

## D8: Double-submit prevention (US1 scenario 4)

- **Decision**: The create (and edit) submit button is disabled while the action transition is pending (React 19 pending state / `useFormStatus`), and the form resets only on success — the primary and sufficient guard. E2E covers the double-click case; the outcome is at most one task per deliberate submit with a consistent result.
- **Rationale**: Pending gating is the standard zero-dependency pattern; combined with the single-flight nature of React transitions it closes the rapid-double-click scenario the spec names.
- **Alternatives considered**: (a) Idempotency keys / request-dedup tokens — rejected: storage, expiry, and client generation machinery to defend a case the pending gate already closes (YAGNI). (b) A DB unique constraint approximating "same submission" — rejected: no honest key exists for free-form task creation (duplicate titles are explicitly allowed).

## D9: Action results and DTOs — extending the F002 predictable-result contract

- **Decision**: Task actions return the same union family as F002's auth actions: `{ status: "success", task?: TaskDto }`, `{ status: "validation_error", fieldErrors: TaskFieldErrors }` (fields: title, description, dueDate, priority, status), `{ status: "failure", message: string }`. A missing/foreign/stale task id maps to a **single friendly failure** ("This task no longer exists") + list revalidation — a foreign id and an already-deleted id are deliberately indistinguishable, covering FR-011's "clear feedback, never a crash" and the cross-user edge case without leaking existence. `TaskDto` carries only UI fields (no `userId`, no timestamps beyond the list-ordering `createdAt`).
- **Rationale**: One predictable result shape across the app's mutation surface keeps the five-step contract honest and the client simple; the indistinguishable-failure mapping is the cheapest correct answer to three edge cases at once.
- **Alternatives considered**: (a) Distinct "not found" vs "not yours" failures — rejected: an existence leak (a user could probe task ids); constitution I forbids cross-user reads *including metadata*. (b) Returning raw Prisma task objects — rejected: violates the constitution's five-step constraint wording.

## D10: Deletion — scoped `deleteMany`, permanent, cascade-backed

- **Decision**: `deleteTask` runs `task.deleteMany({ where: { id, userId } })`; `count === 0` → the friendly failure from D9; success → the row is gone permanently (no undo, spec assumption). The `User → Task` FK is `onDelete: Cascade`, so account removal leaves no orphan tasks (consistent with F002's Session cascade).
- **Rationale**: `deleteMany` with the ownership predicate merges authorization and execution into one atomic statement — no check-then-act window; the count result simultaneously handles foreign-id, stale-id, and not-found.
- **Alternatives considered**: (a) Soft delete/undo — rejected: the spec explicitly excludes trash/undo. (b) `delete` after a find-first ownership check — rejected: two queries, a race window, and a distinguishable error path; strictly worse than the scoped `deleteMany`.

## D11: Task Prisma model — including the reserved `categoryId`

- **Decision**: `Task` model per the constitution's data contract: `id` (cuid PK), `userId` (FK → User, cascade), `title` (1–120, trimmed at the schema boundary), `description String?` (≤1000), `status TaskStatus` (enum, default TODO), `priority TaskPriority` (enum, default MEDIUM), `dueDate DateTime? @db.Date`, `categoryId String?` (plain scalar, **no relation/FK yet**), `createdAt`/`updatedAt` Prisma-managed. One migration adds the table + the D6 compound index.
- **Rationale**: The constitution's Task contract names `optional categoryId`; the categories feature will add the `Category` model + relation + index additively. A relation to a nonexistent model is impossible in Prisma, and inventing a minimal `Category` table now would drag categories' scope into F003 (spec Assumptions exclude any category UI). A reserved nullable scalar honors the contract without speculative structure.
- **Alternatives considered**: (a) Omit `categoryId` until a later feature — rejected: the constitution's data model contract is ratified; the column *is* the contract. (b) A minimal `Category` model now — rejected: YAGNI + explicit scope exclusion.

## D12: Test strategy hooks

- **Decision**: Unit: `task-schema` (limits 1–120 / ≤1000, enums, defaults, optional-field clearing, date normalization), `validateTransition` full matrix (all 9 pairs incl. no-ops), `isOverdue` calendar-day matrix (yesterday/today/tomorrow, month and year boundaries, completed-not-overdue, null dueDate), and action authorization with mocked Prisma/`requireSession` (cross-user id, unknown id). Component: TaskForm (defaults, inline field errors, clearing description/dueDate, cancel = untouched), TaskItem (status/priority conveyed by text badge/icon not color, overdue badge, complete/reopen controls), empty state, DeleteConfirmDialog. E2E: create only-title/all-fields/invalid, edit each field + clear optional + cancel, complete → reopen, rapid toggling settles, backward transition rejected, delete confirm/cancel, double-click submit → one task, stale delete from a second tab, list privacy between two users, and the constitution-mandated security scenario (User A cannot read/edit/complete/delete User B's tasks — enforced by the D9/D10 patterns, asserted via action-boundary unit tests plus E2E privacy checks). Rollback simulation (US3 scenario 3) uses Playwright request interception to abort the action POST and assert rollback + error + server consistency.
- **Rationale**: Maps 1:1 to the spec's edge cases and SC-003/SC-004/SC-006/SC-007; the interception trick makes the failure path deterministic without touching app code.
- **Alternatives considered**: (a) Cross-user E2E via URL manipulation — rejected: F003 has no per-task URLs; the honest vector is action invocation, covered at the unit boundary with mocked auth. (b) Seeding 100 tasks through the UI in E2E — rejected: slow; seed via the test harness/DB for the SC-005 check.

## D13: Environment contract — unchanged

- **Decision**: No new environment variables; `DATABASE_URL` + `AUTH_SECRET` (F001/F002) suffice. No `.env.example` or `env.ts` changes.
- **Rationale**: The feature needs no external service or secret; touching the environment contract without cause is churn.
- **Alternatives considered**: none — recorded for completeness.

## Consolidated resolution table

| Original unknown / design question | Resolved by |
|---|---|
| Calendar-day due-date storage & overdue semantics | D1 |
| Forward-only transition enforcement (shared rule, field-level error) | D2 |
| Optimistic completion + rollback + rapid-toggle consistency | D3 |
| List read architecture, field selection, revalidation, DTOs | D4, D9 |
| Ordering & 100-task scale posture | D5 |
| Constitution-mandated index evaluation | D6 |
| Dialog/sheet/confirm surfaces + date input + a11y | D7 |
| Double-submit / at-most-one-task | D8 |
| Deletion semantics (stale/foreign id, cascade, permanent) | D10 |
| Task model incl. reserved `categoryId` | D11 |
| Test strategy incl. security scenario & rollback simulation | D12 |
| Environment contract | D13 |




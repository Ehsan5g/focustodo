# Data Model: Task Search & Filters (F005)

**Feature**: `005-search-filters` | **Date**: 2026-09-17
**Sources of truth**: [spec.md](spec.md) (FR-001–FR-015, 12 edge cases, Assumptions), [research.md](research.md) (D1–D9), [../003-task-management/data-model.md](../003-task-management/data-model.md) (Task entity, status lifecycle), [../004-task-categories/data-model.md](../004-task-categories/data-model.md) (Category, Task.categoryId)

**No new entity and no schema change** (D9): search, filter, and sort criteria are TRANSIENT view settings of the current session — never stored, never migrated, never in the URL (spec Assumptions). The data model is the existing `Task`/`Category` tables read through a new criteria-aware query.

## Entities (unchanged — read-relevant projection)

### Task (existing, F003+F004)

| Field | Read relevance |
|---|---|
| `id`, `title`, `description`, `status`, `priority`, `dueDate`, `createdAt`, `userId` | F003 entity — unchanged; `userId` is the ownership base predicate, `createdAt` the default sort key, `title`/`description` the search targets |
| `categoryId` | F004 nullable FK — equality filter target; resolved against `{ id, userId }` before any task query (D4) |
| *(derived)* `categoryName` | joined by reference at read time into `TaskDto` — F004 D5, never stored on the task |

### Category (existing, F004)

Read only for filter options: `select: { id, name }` scoped `where: { userId }`, ordered by `nameKey` asc — the same projection the F004 picker reads (FR-004).

## View settings (transient — the TaskCriteria shape)

| Criterion | Shared-schema type | Absent = | Semantics | FR |
|---|---|---|---|---|
| `search` | optional string, 1–200 after trim | no search | trimmed; case-insensitive substring over title OR description; matched literally (escape `\ % _`) | FR-001 |
| `status` | optional `TODO\|IN_PROGRESS\|COMPLETED` | All | equality | FR-002 |
| `priority` | optional `LOW\|MEDIUM\|HIGH` | All | equality | FR-003 |
| `categoryId` | optional non-empty string | All | owner-resolved before the query (D4); options are only the user's own categories | FR-004 |
| `dueDate` | optional `OVERDUE\|DUE_TODAY\|DUE_THIS_WEEK\|NO_DUE_DATE` | All | derived UTC calendar-day windows — never stored | FR-005 |
| `sort` | `NEWEST_FIRST\|OLDEST_FIRST\|DUE_EARLIEST\|PRIORITY_HIGH_LOW\|TITLE_A_Z`, default `NEWEST_FIRST` | Newest first | orderBy map with newest-first tie-breaks and due-date nulls last | FR-007 |

Result envelope: `TaskListResult = { status: "success"; tasks: TaskDto[]; total: number } | { status: "validation_error"; fieldErrors } | { status: "failure"; message }` — `total === tasks.length` (one unpaginated query; D1).

## Derivation rules (single definitions — no duplication)

- **Search normalization** (schema only, D2): trim; whitespace-only/absent ⇒ no criterion; 1–200 characters after trim.
- **Escaping** (D3): the token's `\`, `%`, `_` are doubled with a backslash BEFORE `contains` — user input matches literally.
- **Overdue** (D3): `dueDate < startOfToday(UTC)` AND `status != COMPLETED` — identical to F003's `rules.ts` `isOverdue`; a completed task is never overdue (edge case).
- **Windows** (D3): `today` = UTC midnight of the action's `now`; `DUE_TODAY` = `[today, today+1)`; `DUE_THIS_WEEK` = `[today, today+7)` — "today through the next 7 days including today"; `NO_DUE_DATE` = `dueDate: null`. Tasks without a due date are excluded from every dated preset.
- **Sorting** (D3): `NEWEST_FIRST` = `createdAt desc`; `OLDEST_FIRST` = `createdAt asc`; `DUE_EARLIEST` = `dueDate { sort: "asc", nulls: "last" }` then `createdAt desc`; `PRIORITY_HIGH_LOW` = `priority desc` (Postgres enum order LOW→HIGH per the F003 schema) then `createdAt desc`; `TITLE_A_Z` = `title asc` then `createdAt desc`. Every non-createdAt sort ties off newest-first (FR-007, edge case).
- **Count** (D1): `total` is the length of the returned array — the count line and the list read the same result (FR-008).

## Invariants (constitution I + spec rules — checked in every code review)

1. Ownership is the base predicate: every task query starts with `userId` from `requireSession()` — search, filters, count, and sort included (FR-011).
2. Criteria never carry `userId`; `TaskDto` never carries `userId` (F003 invariant).
3. The server re-validates every criterion with `taskFilterSchema` before ANY query; a malformed criterion is a `validation_error` — never a crash, never a widened query (FR-012).
4. A present `categoryId` resolves against `{ id, userId }` first; foreign/unknown/just-deleted are ONE indistinguishable `validation_error` and no task query runs (D4).
5. Overdue and due windows are derived at query time from `now` — never stored, never written (F003's derived-state invariant).
6. Search input is matched literally: only the escaped token reaches `contains`; `%`/`_`/quotes/emoji never alter pattern semantics (edge case).
7. `total === tasks.length`; the count line reads the same result the list renders (FR-008).
8. Defaults: every criterion absent ⇒ all of the user's tasks, newest first — the F003 default list (FR-010, reload edge case).
9. View settings are session-only: not in the URL, not persisted, gone on reload (spec Assumptions).
10. Category options are always the user's own categories, alphabetically — the F004 picker projection (FR-004); a category deleted while selected drops from the options and the active criteria self-heal (D4).

## Validation rules (single Zod source — constitution II)

| Schema | Rules |
|---|---|
| `taskFilterSchema` | optional `search` trimmed 1–200 (whitespace-only ⇒ absent); optional `status`/`priority` enums; optional `categoryId` non-empty string; optional `dueDate` preset enum; `sort` enum default `NEWEST_FIRST` |
| *(unchanged)* `createTaskSchema` / `updateTaskSchema` | F003 field rules + F004 `categoryId` assignment rules — F005 adds nothing to them |

## Traceability

- `TaskCriteria` ← FR-001–FR-005, FR-007 (US1–US4); envelope/count ← FR-006, FR-008 (US5); reset/defaults ← FR-010 + the reload edge case.
- No schema change ← D9; spec Key Entities (Task unchanged) + Assumptions (session-only view settings).
- All 12 spec edge cases carried verbatim into rules: mid-typing inert (D5); no-match empty state (invariants 7–8 + the surfaces contract); description-only match (D3); spaces-only search (D2); special characters (D3); completed-not-overdue (D3); no-due-date exclusion + nulls-last (D3); deleted-category self-heal (D4, invariant 10); stable newest-first ties (D3); 100+ task responsiveness (D6); cross-user scoping (invariant 1); reload returns defaults (invariant 9).


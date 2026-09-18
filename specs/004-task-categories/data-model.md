# Data Model: Task Categories (F004)

**Feature**: `004-task-categories` | **Date**: 2026-09-17
**Sources of truth**: [spec.md](spec.md) (FR-001–FR-015 + Assumptions), [research.md](research.md) (D1, D2, D4, D5, D6), constitution Category/Task data contracts

## Entities

### Category (new)

| Field | Type | Constraints / Rules | Origin |
|---|---|---|---|
| `id` | `String` (cuid, PK) | generated, immutable | constitution data model |
| `userId` | `String` (FK → `User.id`) | `onDelete: Cascade`; every query/mutation is scoped by it — never accepted from the client | FR-004, constitution I |
| `name` | `String` | 1–60 characters after trimming; original case preserved; displayed on every surface | FR-001, spec US1/US3 |
| `nameKey` | `String` | lowercased trimmed name; persisted, never exposed to clients; drives uniqueness (with `userId`) and case-insensitive ordering | FR-002, FR-005, research D1 |
| `createdAt` | `DateTime` | Prisma-managed | constitution |
| `updatedAt` | `DateTime` | Prisma-managed | constitution |

### Task (extended — reserved link activated)

| Field | Change | Constraints / Rules | Origin |
|---|---|---|---|
| `categoryId` | F003 reserved scalar → real FK → `Category.id` | nullable; `onDelete: SetNull`; at most one category per task; assignment resolved against owned categories server-side | FR-006, FR-011, research D2/D4 |
| *(all other fields)* | unchanged from F003 | title/description/status/priority/dueDate rules per F003 data-model.md | F003 |

## Relationships

- `User 1 — * Category` — a category belongs to exactly one user; deleting the user cascades (consistent with Task/Session per-user cleanup).
- `Category 1 — 0..* Task` — a category may carry any number of tasks, including none; adding or removing assignments never affects the category itself (spec edge case).
- `Task * — 0..1 Category` — at most one category per task (FR-006); no category is a first-class state (nullable FK), not a pseudo-entry (spec Assumptions).

## Indexes

| Index | Table | Purpose |
|---|---|---|
| `@@unique([userId, nameKey])` | Category | per-user case-insensitive uniqueness (FR-002); the `userId` leftmost prefix serves every per-user lookup — list, picker, ownership resolution (D1, D6) |
| `@@index([categoryId])` | Task | task-list name join (D5) + the `SetNull` cascade scan on deletion (D2, D6) |
| *(evaluated, deferred)* `status`, `priority`, `dueDate` | Task | unchanged from F003 — no F004 query filters on them; category filtering lands with the later filters feature (D6) |

## Deletion semantics (FR-010, FR-011, SC-004)

- Deletion is permanent — no trash, recycle bin, or undo (spec Assumptions); explicit confirmation states the consequence before anything is removed.
- `deleteCategory` removes exactly one owned row (scoped `deleteMany({ where: { id, userId } })` count pattern); `onDelete: SetNull` nulls `Task.categoryId` for all of its tasks in the same operation — tasks keep every other field.
- Cancellation changes nothing; a category deleted in another tab/session is reflected without a crash, and a stale assignment attempt fails safely with clear feedback (D4).

## Rename semantics (FR-009, SC-005)

- A rename validates under creation rules (1–60 after trim, per-user case-insensitive uniqueness) and writes `name` + `nameKey` once; a rename to the identical current name is a no-op success (spec Assumptions, D8).
- No write-back to tasks: the list, the picker, and every assigned task's label read the name by reference, so all surfaces show the new name immediately (D5).

## Invariants (constitution I + spec rules — checked in every code review)

1. Ownership: every Category read and write predicate includes `userId`, entering only from `requireSession()` — never from the client (FR-004).
2. `nameKey === name.trim().toLowerCase()` at every write; both derive from the one trimmed input in one place — uniqueness and ordering ride `nameKey` only (D1).
3. Uniqueness is enforced by the database compound unique index; any app-level pre-check is a UX fast path, never the authority (D1).
4. Assignment resolution: a non-null `categoryId` must resolve against `{ id, userId }` before any task write; a miss yields a field error on `categoryId` and leaves the task unchanged (D4).
5. Clearing the assignment stores SQL `NULL` — never an empty string (FR-006; F003 clearing pattern).
6. Deleting a category never deletes or modifies any task field other than nulling `categoryId` (FR-011, D2).
7. One category per task: `categoryId` is a single nullable scalar on Task; the picker offers no multi-select (FR-006).
8. No counters, colors, icons, or manual reordering exist anywhere in the model or UI (spec Assumptions).
9. `updatedAt` changes only through user actions on that row (creation, rename); assignment changes touch only the task row.

## Validation rules (from requirements, single Zod source)

| Schema | Rules |
|---|---|
| `createCategorySchema` | `name` required, 1–60 characters after trimming (whitespace-only rejected as empty); `nameKey` derived server-side at the service boundary — never accepted from the client |
| `updateCategorySchema` | identical field rules (rename submits the full form) |
| `categoryIdSchema` | non-empty string id for action params |
| `createTaskSchema` *(extended)* | + optional `categoryId`: non-empty string to assign, `null` for "no category"; default unset |
| `updateTaskSchema` *(extended)* | same `categoryId` rules; submitting `null` clears the assignment (F003 clearing semantics) |

## Traceability

- `Category` ← FR-001–FR-005, FR-009–FR-012, US1/US3/US4, constitution Category data contract (id, userId, name unique per user, timestamps) + index mandate.
- `Task.categoryId` activation ← FR-006–FR-008, US2, constitution Task contract (the reserved optional link F003's D11 held open), spec Key Entities.
- Spec Assumptions carried verbatim into invariants: trim before compare/save, case-insensitive per-user uniqueness, alphabetical ordering without case, one category per task, permanent deletion with confirmation, rename-to-same as a no-op.

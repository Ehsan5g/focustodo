# Data Model: Task Management (F003)

**Feature**: `003-task-management` | **Date**: 2026-09-16
**Sources of truth**: [spec.md](spec.md) (FR-001–FR-016 + clarifications), [research.md](research.md) (D1, D2, D6, D9, D11), constitution Task data contract

## Entities

### Task

| Field | Type | Constraints / Rules | Origin |
|---|---|---|---|
| `id` | `String` (cuid, PK) | generated, immutable | constitution data model |
| `userId` | `String` (FK → `User.id`) | `onDelete: Cascade`; every query/mutation is scoped by it — never accepted from the client | FR-004, constitution I |
| `title` | `String` | 1–120 chars, trimmed (shared Zod) | FR-001, constitution II |
| `description` | `String?` | ≤1000 chars; clearing removes it (null) without side effects | FR-001, FR-007 |
| `status` | `TaskStatus` enum (`TODO` \| `IN_PROGRESS` \| `COMPLETED`) | default `TODO`; creation accepts any valid value; afterwards forward-only (matrix below) | FR-001, FR-002, clarified FR-008 |
| `priority` | `TaskPriority` enum (`LOW` \| `MEDIUM` \| `HIGH`) | default `MEDIUM` | FR-001, FR-002, constitution II |
| `dueDate` | `DateTime?` `@db.Date` | calendar day, no time-of-day (UTC-midnight normalized); optional; clearing removes it | FR-001, clarified FR-012, research D1 |
| `categoryId` | `String?` | reserved scalar — no relation/FK until the categories feature (research D11) | constitution data contract, spec Key Entities |
| `createdAt` | `DateTime` | Prisma-managed; list order (newest-first) | spec Assumptions |
| `updatedAt` | `DateTime` | Prisma-managed | constitution |

## Relationships

- `User 1 — * Task` — a task belongs to exactly one user; deleting the user cascades (no orphan tasks), consistent with F002's `Session` cascade.
- `Task * — 0..1 Category` — reserved via the nullable `categoryId` scalar; the relation materializes additively with the categories feature (D11).

## Indexes

| Index | Table | Purpose |
|---|---|---|
| `@@index([userId, createdAt(sort: Desc)])` | Task | the one F003 read pattern — per-user list, newest-first: filter + sort covered by one index (D6) |
| *(evaluated, deferred)* `status`, `priority`, `dueDate` | Task | no F003 query filters on them; re-evaluate when search/filter/sort land (D6) |
| *(evaluated, deferred)* `categoryId` | Task | no category queries until the categories feature (D6, D11) |

## Status lifecycle (clarified FR-008 — forward-only)

| From \ To | TODO | IN_PROGRESS | COMPLETED |
|---|---|---|---|
| **TODO** | no-op ok | ✔ start | ✔ complete directly (US3 S1) |
| **IN_PROGRESS** | ✘ rejected | no-op ok | ✔ complete |
| **COMPLETED** | ✔ reopen (reset) | ✘ rejected | no-op ok |

- Allowed after creation: `TODO → IN_PROGRESS`, `IN_PROGRESS → COMPLETED`, `TODO → COMPLETED` (forward skip), `COMPLETED → TODO` (reopen), same-status no-ops.
- Rejected: every backward pair — `IN_PROGRESS → TODO`, `COMPLETED → IN_PROGRESS` — surfaces a **field-level error on `status`** and leaves the task unchanged (spec edge case; clarified FR-008).
- At creation any valid status may be initially set (FR-001 / clarification #1); the matrix governs changes after creation.
- The rule is one shared pure function (`validateTransition`, research D2) called by the client edit form and the server action.

## Invariants (constitution I + clarified semantics — checked in every code review)

1. Ownership: every read and write predicate includes `userId`, and `userId` enters only from `requireSession()` — never from the client (FR-004).
2. Overdue is derived at read time, never stored: `dueDate !== null && status !== "COMPLETED" && dueDate < today` (calendar days, D1).
3. `dueDate` is always a UTC-midnight calendar day — no clock time is representable or compared (clarified FR-012).
4. Lifecycle: transitions obey the matrix above; rejected changes leave the row untouched.
5. Clearing optional fields stores `null` (description, dueDate) — never empty strings (FR-007).
6. Titles are trimmed; duplicate titles are allowed — nothing else is unique (spec edge case).
7. No automatic status changes: overdue never mutates status; past due dates are accepted (FR-012, spec Assumptions).
8. `updatedAt` changes only through user actions — derived overdue never writes.

## Validation rules (from requirements, single Zod source)

| Schema | Rules |
|---|---|
| `createTaskSchema` | title 1–120 trimmed (required); description ≤1000 optional; dueDate optional `YYYY-MM-DD` → UTC-midnight `Date` (D1); priority enum with `.default("MEDIUM")`; status enum with `.default("TODO")` (FR-002 defaults shared client/server) |
| `updateTaskSchema` | identical field rules (edit submits the full form); enum shape validated here, forward-only rule enforced against the loaded task (D2) |
| `taskIdSchema` | non-empty string id for action params |

## Traceability

- `Task` ← FR-001–FR-016, US1–US5, constitution data contract + index mandate, both clarifications (Session 2026-09-16).
- First per-user business table; F002's `User`/`Session` and F001's `health_check` scratch table are untouched.

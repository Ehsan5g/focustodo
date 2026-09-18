# Contract: Task Server Actions

Public mutation surface of F003. Constitution: every mutation is a five-step server action; raw database objects are never returned to the client; identity comes from `requireSession()` — a client-supplied `userId` is never accepted (constitution I).

## Result shapes (predictable union — the only thing actions return)

```ts
type TaskFieldErrors = {
  field: "title" | "description" | "dueDate" | "priority" | "status";
  message: string;
}[];

type TaskDto = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null; // ISO calendar day (YYYY-MM-DD) — never a clock time
  createdAt: string;      // ISO timestamp (list ordering)
};

type TaskActionResult =
  | { status: "success"; task: TaskDto }
  | { status: "validation_error"; fieldErrors: TaskFieldErrors }
  | { status: "failure"; message: string }; // generic, friendly; no internals
```

### `createTask(input)` → `TaskActionResult`

| Step | Behavior |
|---|---|
| 1. Validate | `createTaskSchema` (shared Zod): title 1–120 trimmed; description ≤1000 optional; dueDate optional `YYYY-MM-DD`; priority enum (default MEDIUM); status enum (default TODO) |
| 2. Authenticate | `requireSession()` → current `userId` |
| 3. Authorize | creating into one's own list is always allowed — the owner id never comes from the client |
| 4. Execute | create `Task` with validated fields + owner; any valid status may be initially set (clarified FR-001/FR-008) |
| 5. Return | `success(task)` (+ list revalidate) · `validation_error` · `failure` |

### `updateTask(taskId, input)` → `TaskActionResult`

| Step | Behavior |
|---|---|
| 1. Validate | `updateTaskSchema` (same field rules); enum shape here; **forward-only rule below** |
| 2. Authenticate | `requireSession()` |
| 3. Authorize | load task scoped `where: { id: taskId, userId }` — a foreign or unknown id is indistinguishable (D9) |
| 4. Execute | `validateTransition(current, next)` → violation = `validation_error` with a field error on `status` (task unchanged); else update — cleared optionals stored as `null` (FR-007) |
| 5. Return | `success(task)` · `validation_error` · `failure` |

### `setTaskStatus(taskId, next)` → `TaskActionResult`

The complete/reopen single-interaction path (client side is optimistic, D3). Same five steps as `updateTask` with `next ∈ {"COMPLETED", "TODO"}`; the shared transition matrix is enforced identically (`TODO → COMPLETED` and `COMPLETED → TODO` both legal; same-status submissions are no-op successes; a rejected pair yields the `status` field error and leaves the task unchanged).

### `deleteTask(taskId)` → `{ status: "success" } | { status: "failure"; message: string }`

| Step | Behavior |
|---|---|
| 1. Validate | `taskIdSchema` |
| 2. Authenticate | `requireSession()` |
| 3. Authorize | ownership **is** the deletion predicate: `deleteMany({ where: { id, userId } })` (D10) |
| 4. Execute | `count === 0` → stop: foreign id, already-deleted id, and unknown id are indistinguishable |
| 5. Return | `success` (+ list revalidate) · `failure("This task no longer exists. Refresh to see your current list.")` |

## Shared transition rule (single source of truth — research D2)

`validateTransition(from, to)` — the exact matrix lives in [../data-model.md](../data-model.md) (Status lifecycle). The client edit form and the server action call the same function; violations surface as a **field error on `status`**: "Status can only move forward — completed tasks reopen to To do." Rejected transitions leave the task unchanged (spec edge case).

## Error mapping (constitution V — friendly, never technical)

| Condition | Client-visible result |
|---|---|
| Zod issues (limits, enums, date format) | `validation_error` + inline message near the relevant field |
| Backward status transition | `validation_error` with a field error on `status` |
| Unknown / foreign / already-deleted task id | generic `failure` ("no longer exists") — ownership is never distinguished from absence |
| Unexpected error | generic "Something went wrong. Please try again." + server-side diagnostic log |

## Non-negotiables

- The server re-validates every input even though the client also validates (constitution I).
- Every action body shows the five steps, in order; `requireSession()` is called even though the page is guarded (F002 routes contract rule 4).
- No action accepts a client-supplied `userId`; no raw Prisma object crosses the boundary (DTO mapping only).
- No logging of user task content.
- Prisma usage confined to `src/server/` (F001 skeleton rule).

Details: [routes-and-surfaces.md](routes-and-surfaces.md) for the list/surface contract; [../data-model.md](../data-model.md) for the entity and lifecycle matrix.

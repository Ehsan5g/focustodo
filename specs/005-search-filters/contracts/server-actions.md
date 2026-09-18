# Contract: Task List Read — `fetchTasks` (F005)

Public read surface of F005. F003's mutation contracts ([../../003-task-management/contracts/server-actions.md](../../003-task-management/contracts/server-actions.md)) and F004's category/assignment contracts ([../../004-task-categories/contracts/server-actions.md](../../004-task-categories/contracts/server-actions.md)) remain the record for unchanged behavior; this file documents the ONE new action and the read-path rules. Constitution: every request — reads included (user-mandated constraint) — rides a five-step server action returning stable serializable data; identity comes from `requireSession()`; a client-supplied `userId` is never accepted (constitution I).

## Result shapes (predictable unions — the only thing actions return)

```ts
type TaskFilterFieldErrors = {
  field: "search" | "status" | "priority" | "categoryId" | "dueDate";
  message: string;
}[];

type TaskDto = {
  // F003 + F004 shape, unchanged:
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;      // ISO calendar day (YYYY-MM-DD) — never a clock time
  createdAt: string;           // ISO timestamp (list ordering)
  categoryName: string | null; // joined by reference (F004 D5)
  // userId and nameKey never leave the server
};

type TaskListResult =
  | { status: "success"; tasks: TaskDto[]; total: number } // total === tasks.length (unpaginated — D1)
  | { status: "validation_error"; fieldErrors: TaskFilterFieldErrors }
  | { status: "failure"; message: string }; // generic, friendly; no internals
```

### `fetchTasks(input)` → `TaskListResult`

The one new action. `input` is the full criteria object (absent optionals = All) exactly as `taskFilterSchema` defines it.

| Step | Behavior |
|---|---|
| 1. Validate | `taskFilterSchema` (shared Zod): search trimmed (1–200 after trim; whitespace-only ⇒ absent), status/priority/categoryId/dueDate enums, sort default `NEWEST_FIRST` — malformed criteria are `validation_error` BEFORE any query (FR-012, D2) |
| 2. Authenticate | `requireSession()` → current `userId` — even though the page is guarded (F002 rule 4) |
| 3. Authorize | ownership IS the query predicate: `userId` enters only from the session (FR-011); a present `categoryId` is resolved via `category.findFirst({ where: { id, userId } })` — a miss (foreign/unknown/just-deleted) is ONE `validation_error` on `categoryId` and no task query runs (D4) |
| 4. Execute | `buildTaskQuery(criteria, now)` → `{ where, orderBy }` (pure module, D3); ONE `task.findMany` selecting only the list-view fields (+ the `category.name` join); rows map to `TaskDto` — no raw Prisma objects cross the boundary (D1, D9) |
| 5. Return | `success({ tasks, total })` where `total = tasks.length` (FR-008) · `validation_error` · `failure` |

No `revalidatePath` — this is a read; mutation-side revalidation stays F003/F004's responsibility.

### Mutations — deliberately unchanged (D9)

`createTask` / `updateTask` / `setTaskStatus` / `deleteTask` (and all category actions) keep their F003/F004 contracts byte for byte. Freshness of a filtered view (FR-013) is CLIENT-side: after any mutation result, the container re-queries `fetchTasks` with the active criteria (D5). No new mutation action exists.

## Error mapping (constitution V — friendly, never technical)

| Condition | Client-visible result |
|---|---|
| Zod issues (search > 200 chars after trim; unknown status/priority/dueDate/sort value; malformed categoryId) | `validation_error` + inline message near the matching control |
| Whitespace-only search | NOT an error — normalized to "no criterion" (all tasks, FR-001) |
| Foreign / unknown / just-deleted categoryId | `validation_error` on `categoryId`: "This category no longer exists. Refresh to pick a current one." — no task query ran; the client drops the stale criterion and refetches (D4) |
| Unexpected error | generic "Something went wrong. Please try again." + server-side diagnostic log |

## Non-negotiables

- The server re-validates every criterion even though the client also validates (constitution I).
- The action body shows the five steps in order; `requireSession()` is called even though the page is guarded (F002 routes contract rule 4).
- No input accepts a client-supplied `userId`; no raw Prisma object crosses the boundary (DTO mapping only).
- A read NEVER widens: no criterion combination can return another user's task, and a validation failure never runs a partial query (FR-011, FR-012).
- No logging of user task content (search tokens included).
- Prisma usage confined to `src/server/` (F001 skeleton rule).

Details: [routes-and-surfaces.md](routes-and-surfaces.md) for the page/bar contract; [../data-model.md](../data-model.md) for criteria, windows, and invariants.


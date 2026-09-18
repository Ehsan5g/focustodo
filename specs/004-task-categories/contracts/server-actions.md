# Contract: Category Server Actions (+ Task-Assignment Extension)

Public mutation surface of F004. Constitution: every mutation is a five-step server action; raw database objects are never returned to the client; identity comes from `requireSession()` — a client-supplied `userId` is never accepted (constitution I). F003's task-action contracts ([../../003-task-management/contracts/server-actions.md](../../003-task-management/contracts/server-actions.md)) remain the record for unchanged behavior; this file documents the category actions and the assignment extension.

## Result shapes (predictable unions — the only thing actions return)

```ts
type CategoryFieldErrors = {
  field: "name";
  message: string;
}[];

type CategoryDto = {
  id: string;
  name: string;
  // userId and nameKey never leave the server
};

type CategoryActionResult =
  | { status: "success"; category: CategoryDto }
  | { status: "validation_error"; fieldErrors: CategoryFieldErrors }
  | { status: "failure"; message: string }; // generic, friendly; no internals

// F004 extension of the F003 task contract:
//   TaskDto gains           categoryName: string | null;  // read by reference, never stored on the task
//   TaskFieldErrors' field union gains "categoryId";
```

### `createCategory(input)` → `CategoryActionResult`

| Step | Behavior |
|---|---|
| 1. Validate | `createCategorySchema` (shared Zod): `name` required, 1–60 chars after trimming; whitespace-only rejected as empty |
| 2. Authenticate | `requireSession()` → current `userId` |
| 3. Authorize | creating into one's own list is always allowed — the owner id never comes from the client |
| 4. Execute | derive `nameKey`, insert `Category`; P2002 on `@@unique([userId, nameKey])` → duplicate-name field error (D1) |
| 5. Return | `success(category)` (+ list revalidate) · `validation_error` · `failure` |

### `updateCategory(categoryId, input)` → `CategoryActionResult`

| Step | Behavior |
|---|---|
| 1. Validate | `updateCategorySchema` (same field rules) + `categoryIdSchema` |
| 2. Authenticate | `requireSession()` |
| 3. Authorize | load the category scoped `where: { id: categoryId, userId }` — a foreign or unknown id is indistinguishable (D4 pattern) |
| 4. Execute | identical name (after trim) → no-op success (D8); else derive `nameKey` and update — P2002 against a *different* category → duplicate-name field error, old name untouched |
| 5. Return | `success(category)` · `validation_error` · `failure` |

### `deleteCategory(categoryId)` → `{ status: "success" } | { status: "failure"; message: string }`

| Step | Behavior |
|---|---|
| 1. Validate | `categoryIdSchema` |
| 2. Authenticate | `requireSession()` |
| 3. Authorize | ownership **is** the deletion predicate: `deleteMany({ where: { id, userId } })` (F003 D10 pattern) |
| 4. Execute | `count === 0` → stop: foreign id, already-deleted id, and unknown id are indistinguishable; otherwise the row is removed and `SetNull` clears the link on every assigned task (D2) — tasks keep all other data |
| 5. Return | `success` (+ list revalidate) · `failure("This category no longer exists. Refresh to see your current list.")` |

### Task assignment — inside the existing `createTask` / `updateTask` (D3, D4)

No new action. `createTaskSchema`/`updateTaskSchema` gain optional `categoryId` (non-empty string to assign; `null` to clear):

| Step | Change |
|---|---|
| 1. Validate | extended shared schemas validate `categoryId` shape (string or `null`) |
| 2. Authenticate | unchanged (`requireSession()`) |
| 3. Authorize | **new**: a non-null `categoryId` is resolved via `category.findFirst({ where: { id, userId } })` — a miss (foreign, unknown, or just-deleted) yields the `categoryId` field error before any change (US2 S4, D4) |
| 4. Execute | connect the resolved category, or set `categoryId: null` to clear (F003 clearing semantics) |
| 5. Return | `TaskDto` now carries `categoryName` (read by reference — D5) |

## Shared normalization rule (single source of truth — research D1)

`nameKey = name.trim().toLowerCase()` is derived once in the category service at the write boundary — never accepted from the client, never returned. The shared schema owns trimming/length; the service owns the key; the database owns enforcement.

## Error mapping (constitution V — friendly, never technical)

| Condition | Client-visible result |
|---|---|
| Zod issues (empty/spaces-only name, 61+ chars) | `validation_error` + inline message near the `name` field |
| Duplicate name, case-insensitive (create or rename) | `validation_error` on `name`: "You already have a category with this name." |
| Foreign / unknown / just-deleted `categoryId` on assignment | `validation_error` on `categoryId`: "This category no longer exists. Refresh to pick a current one." — task unchanged |
| Unknown / foreign / already-deleted category id on category actions | generic `failure` ("no longer exists") — ownership is never distinguished from absence |
| Unexpected error | generic "Something went wrong. Please try again." + server-side diagnostic log |

## Non-negotiables

- The server re-validates every input even though the client also validates (constitution I).
- Every action body shows the five steps, in order; `requireSession()` is called even though the page is guarded (F002 routes contract rule 4).
- No action accepts a client-supplied `userId` or `nameKey`; no raw Prisma object crosses the boundary (DTO mapping only).
- Deleting a category never deletes or mutates a task beyond nulling `categoryId` (FR-011).
- No logging of user content (category names included).
- Prisma usage confined to `src/server/` (F001 skeleton rule).

Details: [routes-and-surfaces.md](routes-and-surfaces.md) for the page/picker/surface contract; [../data-model.md](../data-model.md) for the entity, deletion, and rename semantics.

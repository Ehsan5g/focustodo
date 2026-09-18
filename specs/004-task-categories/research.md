# Research: Task Categories (F004)

**Feature**: `004-task-categories` | **Date**: 2026-09-17 | **Status**: Complete — no NEEDS CLARIFICATION items remain

The spec closed its clarify pass with zero open markers: every open question had a reasonable default, documented in the spec's Assumptions section, and the checklist validated 16/16. The stack and mutation patterns are fixed by the constitution and inherited from F001–F003 (npm + Node 22 + tooling; Auth.js sessions with `requireSession()`; the five-step action contract; shared Zod schemas; F003's `Task` model with the reserved `categoryId` scalar and its Dialog/Sheet/AlertDialog surfaces). Research below resolves the open *implementation design* decisions only; the one question clarify deferred to planning — where category management lives — is decided here (D7).

## D1: Case-insensitive per-user uniqueness — a persisted `nameKey` + one compound unique index

- **Decision**: `Category` stores `name` exactly as entered after trimming surrounding spaces (original case preserved, 1–60 characters) plus `nameKey` — the lowercased trimmed name, a persisted implementation column never exposed to any client. Uniqueness is enforced by `@@unique([userId, nameKey])` in PostgreSQL; a violating create or rename surfaces as Prisma's P2002 and maps to one friendly field error on `name` ("You already have a category with this name."). Case-insensitive alphabetical ordering (FR-005) uses `orderBy: { nameKey: "asc" }`, so list and picker order are stable without regard to letter case. Both columns are derived from the one trimmed input in one place — the shared schema validates, the service derives `nameKey` at the write boundary.
- **Rationale**: PostgreSQL/Prisma cannot declare a case-insensitive (functional) unique index in `schema.prisma`, so the design question is where normalization lives. A persisted key column keeps enforcement inside the database — the only race-safe place (two concurrent creates must not both win; a check-then-create alone has a TOCTOU window) — while `nameKey`'s byte ordering doubles as the FR-005 ordering key with no per-query `lower()` (which would defeat index use). Deriving both columns from one input in one place means `name` and `nameKey` can never drift.
- **Alternatives considered**: (a) A raw-SQL migration with a functional `UNIQUE INDEX ON lower(name)` — rejected: invisible to `schema.prisma`, drifts from the managed migration history, and cannot drive `orderBy` cleanly. (b) Uniqueness by check-then-create in the action — rejected: concurrent submits can both pass the check; the DB constraint is the honest authority (an app-level pre-check may remain as a UX fast path, never as enforcement). (c) The `citext` extension — rejected: an extension dependency for one column violates YAGNI (constitution III). (d) Storing only lowercased names — rejected: the user's chosen letter case must be displayed ("Work", "Deep Work").

## D2: `Category` table + activating the reserved link — a real relation with `onDelete: SetNull`

- **Decision**: One migration adds the `Category` model — `id` (cuid PK), `userId` (FK → `User.id`, `onDelete: Cascade`), `name`, `nameKey`, `createdAt`/`updatedAt` — and converts Task's reserved `categoryId` scalar (F003 research D11) into a real relation: `category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)`, plus `@@index([categoryId])` on Task. Deleting a category therefore nulls the FK on every assigned task in the same database operation that removes the row — tasks keep title, description, status, priority, and due date and simply show no category (FR-011, SC-004). Deletion remains permanent behind explicit confirmation (spec Assumptions — no trash, no undo).
- **Rationale**: The constitution's data-model contract reserved the optional link for exactly this feature; making it a real relation buys referential integrity and encodes "tasks lose only the category" declaratively, so the rule cannot regress in app code. `SetNull` is precisely the specified semantics; `Cascade` on Category → User matches the per-user cleanup pattern F002/F003 already use (no orphan categories).
- **Alternatives considered**: (a) `onDelete: Restrict` plus an app-level loop nulling tasks before delete — rejected: two writes where one declarative rule suffices, and the loop can miss rows under concurrency. (b) Keeping the scalar and updating tasks manually — rejected: loses integrity; a task could point at a deleted category. (c) Soft delete — explicitly out of scope (spec Assumptions).

## D3: One mutation pipeline per aggregate — category actions for categories, extended task actions for assignment

- **Decision**: New `src/server/categories/` service (list, create, update, delete) behind `src/server/actions/category-actions.ts` exposing exactly three five-step actions: `createCategory(input)`, `updateCategory(categoryId, input)`, `deleteCategory(categoryId)`. Task assignment is **not** a new action: `createTaskSchema` and `updateTaskSchema` gain an optional `categoryId` (a non-empty string, or `null` meaning "no category"), and the existing `createTask`/`updateTask` actions gain one authorization + resolution step (D4). Unassignment submits `categoryId: null`, stored as SQL `NULL` — the same clearing semantics as `description` in F003.
- **Rationale**: Constitution II explicitly names the shared schemas for "create category, update category" and the task-assignment change — extending the existing task schemas keeps one source of truth and one mutation path per field. A separate `assignTaskCategory` action would duplicate `updateTask` and split the five-step pipeline for one column.
- **Alternatives considered**: (a) A dedicated `assignTaskCategory(taskId, categoryId | null)` action — rejected: a second writer for one column with drift risk. (b) A route handler for assignment — rejected: the constitution mandates server actions for mutations. (c) Batch re-assignment across tasks — no such requirement (YAGNI).

## D4: Assignment authorization — resolve against owned categories server-side; foreign/unknown indistinguishable

- **Decision**: In `createTask`/`updateTask`, a non-null `categoryId` is resolved with `category.findFirst({ where: { id: categoryId, userId } })`. A miss — another user's category, an unknown id, or a category deleted in another tab a moment ago (spec edge case) — returns one `validation_error` with a field error on `categoryId` ("This category no longer exists. Refresh to pick a current one.") and leaves the task unchanged; foreign, unknown, and just-deleted are deliberately indistinguishable. The picker can only ever offer the user's own categories (D5), so honest paths never hit this — it is the server boundary catching forged or stale input.
- **Rationale**: US2 scenario 4 requires rejection *before any change happens*; scoping the lookup by the `userId` from `requireSession()` (never the client) is constitution I applied to the link. Reusing F003's "indistinguishable friendly failure" pattern (D9/D10 there) keeps error semantics uniform across features and leaks nothing about which ids exist.
- **Alternatives considered**: (a) Trusting the picker's option list — rejected: client-supplied data is never authorization (constitution I). (b) Distinguishing "foreign" from "not found" errors — rejected: an existence leak. (c) A nested Prisma write connecting the category during the task update — rejected: with a forged id it either fails opaquely or couples ownership to relation mechanics; the explicit resolution step is auditable and testable.

## D5: Read architecture — names ride the task query; renames propagate by reference

- **Decision**: The task list read extends its `select` with `category: { select: { name: true } }` — only the name — and `TaskDto` gains `categoryName: string | null`. No category name is ever denormalized onto tasks: a rename (FR-009) is visible on the category list, in the picker, and on every assigned task with zero write-back, so SC-005 holds by construction. The management page and the picker consume one projection: `category.findMany({ where: { userId }, orderBy: { nameKey: "asc" }, select: { id, name } })` (D1).
- **Rationale**: The relation already guarantees reference semantics; reading through it satisfies FR-009/SC-005 with no update fan-out. Selecting only UI-required fields is constitution III, and one shared projection keeps the page and picker consistent by sharing data rather than duplicating queries.
- **Alternatives considered**: (a) Storing the name on the task — rejected: a rename would need to update N rows (write amplification, drift risk) for zero read gain. (b) Two different projections for page and picker — rejected: needless divergence between surfaces that must agree (SC-005).

## D6: Index evaluation (constitution mandate; the spec names the two patterns)

- **Decision**: Adopted — `@@unique([userId, nameKey])` on Category: its `userId` leftmost prefix serves every per-user category lookup (management list, picker, ownership resolution in D4) while the full compound enforces FR-002; `@@index([categoryId])` on Task: serves the task-list name join (D5) and the `SetNull` cascade scan on deletion (D2). Deferred with reasons — F003's deferred `status`/`priority`/`dueDate` candidates stay deferred (F004 adds no query filtering on them; category-based task filtering arrives with the later filters feature), and a standalone `@@index([userId])` on Category is redundant under the compound unique's leftmost-prefix rule.
- **Rationale**: The spec's Constraints section names exactly two query patterns to evaluate — `Category.userId` and `Task.categoryId` — and both are covered by adopted indexes; anything further is speculative structure (constitution III).
- **Alternatives considered**: Additional indexes leading with `nameKey` alone — rejected: no query orders or filters categories without a `userId` scope; ownership always applies first.

## D7: Surfaces — a dedicated `/categories` page; the picker lives inside the task form

- **Decision**: Category management gets one new protected route, `/categories` (`src/app/(protected)/categories/page.tsx`), reached from the existing protected navigation (sidebar on desktop, compact nav on mobile — constitution V). The page lists the user's categories alphabetically with create, rename, and delete controls. Create/edit reuse F003's adaptive Dialog (desktop ≥sm) / Sheet (mobile <sm) components — FR-013 pins exactly this surface behavior; delete reuses AlertDialog with consequence-stating copy ("assigned tasks become uncategorized but are not deleted" — FR-010). Assignment happens inside the existing `TaskForm` (create + edit) as a labeled select whose unset state — shown as "No category" and the control's default — is the first-class unassigned choice (FR-006); the spec's Assumptions exclude an "uncategorized" pseudo-entry, so the unset value is the select's empty state, never a listed item. When the user has no categories, the picker shows the FR-012 empty state with a clear next action linking to `/categories`.
- **Rationale**: The clarify pass deferred "where does management live" to planning; constitution V fixes sidebar navigation on desktop, and a list page carrying three mutations is the simplest honest home for it (constitution III). Reusing F003's surface components inherits their keyboard/focus/label behavior and adds zero dependencies. A select scales to the SC-006 50-category case where radio-style choosers do not.
- **Alternatives considered**: (a) Inline management in a popover on the task list — rejected: three mutations plus a destructive confirmation do not fit a popover and would bloat the task page. (b) Modal-only management with no route — rejected: the category list is a first-class artifact of this feature and deserves a shareable, refreshable location. (c) A dedicated assignment page outside the task form — rejected: FR-006 places assignment at task create/edit time; moving it would break the specified journey.

## D8: Duplicate submits and rename-to-same-name semantics

- **Decision**: Category forms disable submit while pending (the F003 double-submit pattern), so rapid re-submits create at most one category — with the D1 database constraint as the race backstop. Renaming to the identical current name (after trimming) is a no-op success per the spec's Assumptions: the action compares against the already-loaded row and returns `success` without a write. Renaming to a name colliding with a *different* category hits P2002 → the friendly `name` field error.
- **Rationale**: The spec fixes both behaviors; the same-value check needs the loaded row that authorization fetches anyway, and everything else falls out of D1/D3 with no extra machinery.
- **Alternatives considered**: Always writing and excluding the row itself from the uniqueness predicate — rejected: more moving parts than an explicit equality no-op, and it obscures the Assumption in constraint mechanics.

## D9: DTOs and result shapes — mirror F003 exactly

- **Decision**: `CategoryDto { id, name }` — `userId` and `nameKey` never cross the boundary. `CategoryActionResult` mirrors F003's `TaskActionResult`: `success(category)` / `validation_error(fieldErrors)` / `failure(message)`; `deleteCategory` returns the F003 delete shape (`success` or `failure`). `TaskFieldErrors`' field union gains `"categoryId"`; `TaskDto` gains `categoryName: string | null`. Error copy stays friendly and technical-detail-free (FR-014).
- **Rationale**: A predictable result union is the constitution's five-step step 5; mirroring F003 keeps one client-side handling pattern across features instead of inventing a second shape dialect.
- **Alternatives considered**: Raw Prisma objects across the boundary — prohibited (constitution I). A richer `CategoryDto` with timestamps — rejected: no UI needs them (constitution III: fetch only what the interface needs).

## D10: Test strategy

- **Decision**: Unit — `category-schema` (trim, whitespace-only rejection, 1–60 boundary: exactly 60 accepted / 61 rejected, `nameKey` derivation), extended task schemas (`categoryId` optional, `null` clears), and category service authorization with mocked Prisma/`requireSession` (every read/write scoped `where { userId }`; assignment resolution: foreign/unknown/stale ids return the same field error and change nothing; delete via `deleteMany` + count; `SetNull` modeled). Component — CategoryForm (inline errors, boundary values, pending state), picker (own categories only, "No category" default first-class, empty state with next action), category list (alphabetical case-insensitive order), delete confirmation copy, TaskItem name label (never color alone). E2E — create valid/invalid (case-insensitive duplicate, 61 chars, spaces-only), assign on create and edit, change, remove; rename propagates to list, picker, and every assigned task label (SC-005); delete with confirm → tasks intact and uncategorized (SC-004), cancel → untouched; cross-user security: User A cannot view, rename, delete, or assign User B's categories (SC-003, the constitution-mandated scenario); delete-in-another-tab staleness; rename-while-editing shows the current name; seeded 50 categories + 100 tasks scale check across desktop/tablet/mobile viewports (SC-006); keyboard-only a11y walk of all surfaces (FR-013).
- **Rationale**: Maps 1:1 to the acceptance scenarios, the edge-case list, and SC-003/004/005/006; the same three-layer strategy as F003 keeps gates uniform (constitution IV). Scale data is seeded via the test harness/DB, never through the UI.
- **Alternatives considered**: (a) Cross-user E2E via URL manipulation — rejected: F004 has no per-category URLs; the honest vector is action invocation, covered at the unit boundary with mocked auth plus E2E picker-isolation checks. (b) Seeding 150 rows through the UI — rejected: slow and flaky.

## D11: Environment contract — unchanged

- **Decision**: No new environment variables; `DATABASE_URL` + `AUTH_SECRET` (F001/F002) suffice. No `.env.example` or env-module changes.
- **Rationale**: The feature needs no external service or secret; touching the environment contract without cause is churn.
- **Alternatives considered**: none — recorded for completeness.

## Consolidated resolution table

| Original unknown / design question | Resolved by |
|---|---|
| Case-insensitive per-user uniqueness mechanics + ordering | D1 |
| Category storage, activating Task.categoryId, deletion semantics | D2 |
| Where assignment mutations live | D3 |
| Assignment authorization + stale-category handling | D4 |
| Read architecture + rename propagation | D5 |
| Constitution-mandated index evaluation | D6 |
| Where management lives; picker placement and unset semantics | D7 |
| Double-submit / rename-to-same-name | D8 |
| DTOs and result shapes | D9 |
| Test strategy incl. security and scale scenarios | D10 |
| Environment contract | D11 |

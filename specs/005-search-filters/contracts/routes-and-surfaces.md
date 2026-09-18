# Contract: Routes, Surfaces, and Read Semantics (F005)

## Route map (F005 adds no route)

| Route | Group | Access | Behavior |
|---|---|---|---|
| `/` | `(protected)` | signed-in only | F003/F004 task list — now hosts the filter bar, count line, and no-match empty state (US1–US5) |
| `/categories` | `(protected)` | signed-in only | F004 category management (untouched) |
| `/sign-in`, `/register` | `(auth)` | public | F002 auth views (untouched) |
| `/api/health` | — | public | F001 infrastructure probe (untouched) |

## Guards (inherited from F002 — unchanged)

1. `middleware.ts` (edge, advisory): coarse session-cookie/JWT check → redirect to `/sign-in?next=…`.
2. `(protected)` layout (authoritative): `requireSession()` — nothing protected renders before this passes.
3. `(auth)` layout (reverse guard): a valid session is bounced to the protected area.
4. **Rule 4 applies to the read too**: `fetchTasks` calls `requireSession()` itself on every invocation (F005 server-actions contract).

## Read contract (server-only)

- The `/` page renders as a Server Component with DEFAULT criteria (all tasks, newest first) plus the user's category options — `task.findMany` scoped `userId` with F003/F004's projection (+ the `categoryName` join) and `category.findMany` scoped `userId` ordered by `nameKey` asc, selecting `{ id, name }` (FR-004).
- Every criteria change (and every mutation-settled refetch) goes through `fetchTasks` — the page's server render is only the INITIAL data; the client container owns the view afterwards (D1, D5).
- Pages render as Server Components; DTO mapping happens before anything crosses to a client component.

## Surfaces

| Surface | Where | Contract |
|---|---|---|
| Search box | filter bar, labeled "Search tasks" | submit-only (FR-001): typing NEVER narrows; Enter or the explicit submit control fires exactly one `fetchTasks`; whitespace-only ⇒ all tasks; an over-200-char (post-trim) value is rejected inline before submit; special characters match literally |
| Status filter | select: All / To Do / In Progress / Completed | change → immediate refetch (FR-002) |
| Priority filter | select: All / Low / Medium / High | change → immediate refetch (FR-003) |
| Category filter | select: All + the user's own categories alphabetically | options are ONLY the user's own categories (FR-004); a category deleted while selected disappears from the options and the active criterion self-heals — dropped + one refetch (D4 edge case) |
| Due-date filter | select: All / Overdue / Due today / Due this week / No due date | change → immediate refetch (FR-005); overdue excludes completed tasks; dated presets exclude tasks without a due date |
| Sort control | select: Newest first (default) / Oldest first / Due date earliest first / Priority high to low / Title A to Z | change → immediate refetch; reorders whatever is currently shown, never widens it (FR-007, US4 S4) |
| Reset control | "Reset filters", visible while ANY criterion is active | clears the search, returns every filter to All, returns sort to Newest first, shows the full list (FR-010); a second reset action lives in the no-match empty state (FR-009) |
| Count line | between bar and list, visible while any criterion is active | "N task(s) match" — N is the same result the list renders (FR-008, invariant 7); announced politely to screen readers |
| No-match empty state | replaces the list when `total === 0` while a criterion is active | "No tasks match your filters" + a reset action; the user's tasks still exist — never an error (FR-009, edge case) |
| Pending state | while a read is in flight | visible, non-blocking indicator; the previous list stays put until the new result lands |
| Task list + items | unchanged F003/F004 rendering | items keep title/description/status/priority/dueDate/categoryName; mutation controls unchanged |
| Mutation refresh (FR-013) | container-wide | the create/edit control and `TaskItem` actions signal the container via the `onSettled` callback; the container refetches the ACTIVE criteria after any result — a created matching task appears, a completed/deleted matching task leaves the view (US5 S4) |

## Interaction rules

1. One `fetchTasks` per criteria change; the container serializes in-flight reads (last change wins) — no race ever shows a stale view for the current criteria.
2. Reset (either path) = defaults: empty search, All/All/All/All, Newest first — identical to the first render (FR-010).
3. Full reload = defaults (session-only view settings — spec Assumptions); nothing persists in the URL or storage.
4. An EMPTY task list (no tasks at all) keeps F003's helpful empty state with its create action; the no-match empty state only appears when a criterion is active (FR-009).

## A11y & UX rules (FR-014, constitution V)

- Every control keyboard-operable with visible focus and a clear label; the count line announced politely (aria-live).
- Inline errors adjacent to their control (e.g., search too long, the stale-category note).
- The bar stacks vertically at 320 px; no horizontal scrolling at any supported viewport (320–1280 px); nothing conveyed by color alone.
- Responsive at 100+ tasks with no visual degradation (SC-006, D6).

Details: [server-actions.md](server-actions.md) for the read contract; [../data-model.md](../data-model.md) for criteria, windows, and invariants.

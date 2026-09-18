# Contract: Routes, Surfaces, and Jumps (F006)

## Route map (F006 adds one route)

| Route | Group | Access | Behavior |
|---|---|---|---|
| `/dashboard` | `(protected)` | signed-in only | F006 dashboard view — Server Component; `requireSession()` via the layout; renders from `fetchDashboardData` (research D6) |
| `/` | `(protected)` | signed-in only | F003–F005 task list — EXTENDED with the one-shot `?seed` jump param (research D5); F005 behavior otherwise unchanged |
| `/categories` | `(protected)` | signed-in only | F004 category management (untouched) |
| `/sign-in`, `/register` | `(auth)` | public | F002 auth views — post-sign-in default destination changes (FR-014, below) |
| `/api/health` | — | public | F001 probe (untouched) |

## Guards (inherited from F002 — unchanged)

The two-layer guard chain applies to `/dashboard` exactly as to `/`: middleware advisory check (unauthenticated direct visits → `/sign-in?next=/dashboard`), then the `(protected)` layout's authoritative `requireSession()`. No data can leak signed-out (spec edge case). The read action runs `requireSession()` itself on every invocation (F002 rule 4).

## FR-014 wiring (navigation + landing)

1. **Primary navigation**: the `(protected)` layout's nav gains a "Dashboard" link (beside Tasks/Categories), keyboard-operable with visible focus, current-page state indicated by more than color.
2. **Post-sign-in landing**: the F002 sign-in flow's **default destination** (absent `?next=`) becomes `/dashboard`. Explicit `?next` handling — including its documented as-is, open-redirect-accepted posture — is untouched, as is the `(auth)` reverse guard.
3. **No prerequisites**: neither the landing nor the nav link requires any task or category to exist (FR-014) — empty states own that path (FR-004).
4. Route semantics unchanged: a signed-in user visiting `/` directly still sees the task list; only the post-sign-in default moved (research D6).

## Jump contract (FR-008/FR-010 — research D5)

Summary links are plain navigations to the task list carrying a **one-shot seed**:

| Summary | Link target | Seed criteria |
|---|---|---|
| Overdue (count > 0) | `/?seed=<b64url>` | `{ "dueDate": "OVERDUE" }` — F005's overdue preset |
| Due today (count > 0) | `/?seed=<b64url>` | `{ "dueDate": "DUE_TODAY" }` — F005's due-today preset (clarification 2) |
| Priority High/Medium/Low (count > 0) | `/?seed=<b64url>` | `{ "priority": "HIGH" \| "MEDIUM" \| "LOW" }` |
| Any summary with count = 0 | — | NOT clickable: rendered as static text (no anchor/button, `aria-disabled` + explanatory label), never a dead link |

**Seed rules** (list side):
1. Read `searchParams.seed` once on the server render; absent ⇒ F005 defaults, zero behavioral change.
2. Decode (base64url JSON) and validate through the **shared `taskFilterSchema`** (Principle II / FR-010) — any parse/validation failure ⇒ defaults, silently; malformed values never reach a query.
3. Hydrate the list container with the validated criteria as its initial view, then `router.replace` to strip the param — the URL is clean immediately after mount.
4. Thereafter the view is a normal F005 session: reload ⇒ defaults; criteria never re-enter the URL (F005 invariant preserved). The seed is the ONLY sanctioned URL surface for list criteria.

**Calendar note on jumps**: the overdue/due-today jumps run F005's UTC-based presets by design (clarification 1); around midnight the landed list may show a different set than the dashboard counted — the summary card's accessible label states it opens "the task list's overdue view" so the difference is self-explanatory.

## Surfaces

| Surface | Where | Contract |
|---|---|---|
| Overdue summary | dashboard, above the fold (SC-006) | count + label; clickable iff count > 0 (jump contract); calm empty state at zero ("Nothing is overdue" + next action) — zero is never styled as alarm (US1) |
| Due-today summary | dashboard | same rules as overdue; zero ⇒ calm empty state with next action |
| Priority distribution | dashboard | Low/Medium/High counts + open total; each non-zero count is a jump link; zero counts shown plainly; status/priority never color-only (Principle V) |
| Recent tasks | dashboard | ≤ 5 items: title, status, priority, due date (FR-003); each item links to the task list (FR-009 — the dashboard itself offers no task actions); "View all tasks" link below |
| Empty states (FR-004) | per summary + page-level | no tasks at all ⇒ welcoming "create your first task" state (US3 S4); no overdue / no due-today / no open tasks ⇒ calm per-summary states with a suggested next action; never errors |
| Long titles | recent list | truncate with ellipsis; full text available on the task list; layout never breaks (spec edge case, SC-007) |
| Loading | dashboard | server-rendered with streaming/suspense fallback per F001 shell conventions; visible, non-blocking |
| Timezone hint | dashboard page | tiny client script supplies `Intl…timeZone` to the read action (D1); invisible to the user; failure ⇒ UTC fallback with no visible error |

## Interaction rules

1. One `fetchDashboardData` per dashboard view; every number derives from the same `now` (consistency).
2. The dashboard is read-only: no mutations, no optimistic updates (Principle V's optimistic rules simply don't apply); all task actions live on the task list (FR-009).
3. Reflection (FR-006): create/complete/edit/delete anywhere ⇒ next dashboard view recomputes from current data; no ghost entries after deletion (spec edge case).
4. Jump targets always land on the list with the seeded filter ACTIVE and visible in the filter bar (the user can see and reset it via F005's reset control).

## A11y & UX rules (FR-011, constitution V)

- Semantic HTML (`nav`, `section` + headings, lists as lists); every summary keyboard-operable with visible focus and a clear accessible name; zero-count summaries announced as static information, not disabled controls to trip over.
- Status and priority conveyed by text/icon, never color alone; contrast per theme (light + dark).
- Responsive 320–1280 px: summaries stack on mobile, grid on desktop; no horizontal scrolling; recent items remain tap-friendly.
- Numbers load within the 2 s budget and appear without scrolling (SC-006).

Details: [server-actions.md](server-actions.md) for the read action; [../data-model.md](../data-model.md) for the split-calendar boundary; [../quickstart.md](../quickstart.md) for validation scenarios.
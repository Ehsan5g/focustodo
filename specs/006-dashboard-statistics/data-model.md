# Data Model & Computed Views: Dashboard Statistics (F006)

**Feature**: `006-dashboard-statistics` | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## No new entities

The dashboard is a read-only projection over the existing `Task` model (F003 schema). **No new database entities, no columns, no migrations, no persisted state.** All statistics are derived at request time from `now` and the user's tasks (F003's derived-state invariant; spec Key Entities).

### Existing entity reference (unchanged)

- **Task** (F003): `id`, `userId`, `title`, `description`, `status` (`TODO|IN_PROGRESS|COMPLETED`), `priority` (`LOW|MEDIUM|HIGH`, Postgres enum order LOW→HIGH), `dueDate` (optional calendar date, no time), `categoryId` (optional, F004), `createdAt`, `updatedAt`. Index pattern: per-user queries led by `userId` with `status`/`priority`/`dueDate` filters (constitution Principle III).
- **Ownership**: every query filters `userId = session.user.id` — the dashboard is always single-user (FR-005, Principle I).

## Computed views

### 1. Overdue count

| Aspect | Definition |
|---|---|
| Rule | `dueDate` in the dashboard's local **past** (before start-of-local-today, D1) AND `status != COMPLETED` |
| Calendar | **User-perceived local day** (D1) — a validated IANA hint with UTC fallback |
| Exclusions | Completed tasks are NEVER overdue (F003/F005 parity); tasks without a due date are excluded |
| Relation to F005 | F005's `OVERDUE` preset uses the identical rule with **UTC** windows (F005 data-model D3); the two agree for every task whose due date is the same day under both calendars and MAY differ for midnight-boundary tasks (FR-007, by design) |

### 2. Due-today count

| Aspect | Definition |
|---|---|
| Rule | `dueDate` = the dashboard's **local today** (the calendar day containing `now` in the D1 zone) AND `status != COMPLETED` |
| Window | `[startOfLocalToday, startOfLocalToday + 1 day)` — a day, not an hour; a task due today stays due today until the user's date changes (spec edge case) |
| Exclusions | Completed tasks and no-due-date tasks excluded |
| Relation to F005 | Mirrors F005's `DUE_TODAY` preset (`[today, today+1)` UTC) — same-day agreement, boundary MAY differ (FR-007) |

### 3. Priority distribution

| Aspect | Definition |
|---|---|
| Rule | `status != COMPLETED`, grouped by `priority` — counts for `LOW`, `MEDIUM`, `HIGH`, plus `openTaskTotal` = the sum |
| Calendar | None — uses no dates, so FR-007's boundary rules never affect it (FR-007 explicitly) |
| Zero counts | Rendered as 0 or a clear empty state per FR-004; every priority always appears with a count |

### 4. Recent tasks (up to 5)

| Aspect | Definition |
|---|---|
| Rule | The user's five tasks with the highest `updatedAt`, newest activity first (creation counts as activity — `updatedAt` starts at `createdAt`) |
| Tie-break | `updatedAt` desc, then `id` asc — two same-instant updates keep a stable order, no flickering (spec edge case) |
| Projection | `id, title, status, priority, dueDate` only (FR-003 fields); description/category excluded |
| Status parity | Includes completed tasks (recent activity is what matters); completion shows via status, never color alone (Principle V) |

## The split-calendar boundary (FR-007, clarification 1)

Two calendars operate side by side — this is by design, not a bug:

| | Dashboard | Task list (F005) |
|---|---|---|
| "today" source | User-perceived local day (D1 hint, UTC fallback) | UTC (F005 D3) |
| Overdue window | `dueDate < startOfLocalToday`, not COMPLETED | `dueDate < startOfUTCToday`, not COMPLETED |
| Due-today window | `[startOfLocalToday, +1 day)`, not COMPLETED | `[startOfUTCToday, +1 day)`, not COMPLETED |

- **Same-day tasks** (same calendar day under both calendars): counts MUST agree — automated consistency tests assert equality (SC-002).
- **Midnight-boundary tasks** (different day under the two calendars — e.g. `now = 2026-03-01T00:30Z` with hint `Asia/Tokyo` ⇒ local today is 2026-03-01, but a task due 2026-03-01 UTC is "tomorrow" on the list while a task due 2026-02-28 is still "today" locally): counts MAY differ; the difference is deterministic and asserted, never flaky (D7).
- **Priority distribution**: date-free — identical under both calendars, always.

### Worked example (also the unit-test fixture, D7)

Due dates are date-only; divergence occurs when the local date ≠ the UTC date.

**Case 1 — `now = 2026-02-28T20:30:00Z`, hint = `Asia/Tokyo`** (local 2026-03-01 05:30 ⇒ local today = **2026-03-01**; UTC today = 2026-02-28):

| Task | Status | Due | F005 UTC view | Dashboard local view |
|---|---|---|---|---|
| A | TODO | 2026-02-27 | overdue | overdue (agrees) |
| B | TODO | 2026-02-28 | due today | **overdue** — boundary divergence |
| C | TODO | 2026-03-01 | not due (tomorrow) | **due today** — boundary divergence |
| D | COMPLETED | 2026-02-27 | excluded (never overdue) | excluded |

**Case 2 — `now = 2026-03-01T03:30:00Z`, hint = `America/New_York`** (local 2026-02-28 22:30 ⇒ local today = **2026-02-28**; UTC today = 2026-03-01) — the reverse divergence: B is due today locally but overdue on the list; C is due today on the list but tomorrow locally.

Both directions are asserted in the unit matrix (D7), alongside same-day agreement cases (e.g. hint = UTC, or mid-day `now` where all zones share the date ⇒ counts MUST be equal per SC-002).

## Serialization & invariants

1. **Derived, never stored** — counts/windows computed at request time from the action's `now`; no caching, no snapshot tables (F003 invariant).
2. **DTO-only** — `DashboardData` (research D4) crosses to the client; ISO-8601 strings for dates; no Prisma types, no `Date` instances.
3. **Single-user scope** — every view's `where` includes `userId = session user`; no client-supplied identifier participates (FR-005).
4. **Open-only counting** — the overdue, due-today, and distribution views exclude `COMPLETED`; the recent list is the only view that may include completed tasks (recency), flagged by status.
5. **No-due-date exclusion** — tasks with `dueDate: null` never enter overdue or due-today (F005 parity).
6. **Deterministic boundaries** — for any fixed `now` + hint, every count is exactly determined; tests inject `now` (D7) rather than reading wall-clock time.

## Input contract (the only new "data" surface)

| Field | Type | Rules |
|---|---|---|
| `timeZoneHint` | optional string | Valid IANA zone (Zod-validated via `Intl.DateTimeFormat`); absent/invalid ⇒ UTC fallback; presentation-only (D1) — never affects user scope or authorization |

The jump's `?seed` param (research D5) carries the same validated shapes as F005's `taskFilterSchema` — see [contracts/routes-and-surfaces.md](contracts/routes-and-surfaces.md); no new validation schema is introduced.

Details: [contracts/server-actions.md](contracts/server-actions.md) for the action; [quickstart.md](quickstart.md) for scenario coverage.
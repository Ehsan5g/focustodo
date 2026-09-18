# Research & Decisions: Dashboard Statistics (F006)

**Feature**: `006-dashboard-statistics` | **Status**: Complete — all planning decisions resolved

The clarify session (2026-09-17) routed three decisions to planning: how the dashboard's "user-perceived local day" is obtained (D1), the dashboard's URL/route + post-sign-in redirect (D6), and how the jump mechanism seeds F005 list criteria without violating the no-URL rule (D5). This document resolves those plus the supporting decisions D2, D3, D4, D7. Format per the plan workflow: Decision / Rationale / Alternatives considered.

## D1 — Local-day derivation (the "user-perceived local day", no per-user timezone stored)

**Decision**: The dashboard page (Server Component) receives an optional, schema-validated **IANA timezone hint** from the client (`Intl.DateTimeFormat().resolvedOptions().timeZone`, delivered by a tiny hydration script writing a hidden field / cookie-free request param on the read action call). The action validates it with Zod (`z.string().refine(isValidIANAZone)` — try `new Intl.DateTimeFormat('en-US', { timeZone: value })`, catch ⇒ invalid), and on any failure **falls back to the F005 UTC convention** for deriving "today"/"overdue". The hint is a presentation input only: it never enters identity, authorization, or the user scope, and it is never persisted (no cookie, no DB column).

- "Today" on the dashboard = the calendar day containing `now` **in the validated hint zone**; "overdue" = `dueDate < startOfLocalToday` AND `status != COMPLETED` (same open-task rule as F003/F005, different calendar).
- Consistency with the task list (FR-007) holds for every task whose due date falls in the same day under both calendars; midnight-boundary tasks may legitimately differ and MUST be tested (SC-002).

**Rationale**: The constitution fixes the stack — adding a per-user timezone column would require a migration and new user-profile UI for marginal benefit, and the spec explicitly forbids per-user timezone storage for this feature ("no per-user timezone is stored"). `Intl.DateTimeFormat` time-zone support is baseline across all evergreen browsers, so the client can always supply a hint. Falling back to UTC (the F005 list convention) keeps counts self-consistent even when the hint is absent, stale, or spoofed — the dashboard degrades to the same calendar as the list rather than to something third.

**Alternatives considered**:
- *Per-user timezone column* (set at sign-up, editable in a profile view): rejected — needs a migration + new UI, contradicts the clarify answer, and the dashboard alone doesn't justify it.
- *Client-only day derivation* (compute counts in a client component from local data): rejected — violates Principle III (business logic in components, client DB access is forbidden) and Principle I (counts must come from the server over server-scoped queries).
- *UTC only, document the discrepancy*: rejected — the clarify session chose a genuine local-day dashboard, not a documented approximation.
- *Geo-IP resolution server-side*: rejected — unreliable, intrusive, and wrong behind VPNs.

## D2 — Query shape and performance (<2 s with 100+ tasks, SC-001/FR-012)

**Decision**: One action, a small bounded set of Prisma queries, all scoped `userId` and selecting **only summary fields**:
1. `count` for overdue and due-today (two `count` calls with `where` per D1's windows and `status != COMPLETED`),
2. `groupBy` on `priority` with `_count` + `where status != COMPLETED` for the distribution, plus one `count` for the open total,
3. `findMany` `{ take: 5, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] }` for the recent list (title/status/priority/dueDate projection only).

All run against the per-user index pattern the constitution mandates (`Task.userId` leading; `status`, `priority`, `dueDate` as filters — the F003-planned composite indexes cover these shapes). Ties on `updatedAt` break by `id` so two same-instant updates keep a stable order (spec edge case: no flickering). At 100+ tasks these are index-backed aggregate reads — no N+1, no full-row scans.

**Rationale**: `count`/`groupBy` push the aggregation into Postgres and return scalars, keeping payloads tiny; the only row fetch is capped at 5. This fits the constitution's "fetch only the fields the summaries need" constraint verbatim.

**Alternatives considered**:
- *Single `findMany` of all open tasks + in-memory aggregation*: rejected — fetches full rows (violates the field-selection constraint) and scales with task count rather than with the summaries' size.
- *Raw SQL aggregation view/materialized stats table*: rejected — new schema/maintenance burden for a sub-2-second target already met by indexed counts; nothing new is persisted (Key Entities).
- *Parallel unbounded queries*: rejected — sequential index-backed counts on a per-user table are fast enough and keep the action simple/deterministic.

## D3 — Statistics computation shape (five-step contract, Principle III)

**Decision**: One read action `fetchDashboardData(input?)` following the five-step contract, with the business logic extracted into a **pure module** `lib/statistics.ts` (`computeStatistics(tasks/counts-input, now, localDay)`) that is unit-testable without Next.js or the database. The action validates input → `requireSession()` → authorize (implicit — scope is the session user) → execute queries + pure computation → map to DTO (`lib/dashboard-dto.ts`). Counts and windows are derived at request time from `now` — never stored, never cached (F003's derived-state invariant carries over).

**Rationale**: Mirrors F005's `buildTaskQuery`/`fetchTasks` split, which is the established house pattern. The pure module is where the overdue/due-today definitions and the midnight-boundary logic live, so SC-004's unit coverage is straightforward; the action stays "small and focused" per Principle III.

**Alternatives considered**:
- *Inline computation in the action*: rejected — untestable in isolation and bloats the action.
- *Separate action per summary (overdue / due-today / priority / recent)*: rejected — four invocations re-pay authentication and round-trips; one call is simpler, faster, and keeps the summaries mutually consistent (all numbers from the same instant `now`).
- *Client-side derivation from a fetched task list*: rejected — see D1; client business logic is forbidden.

## D4 — DTO surface (Principle I: raw DB objects never reach the client)

**Decision**: `DashboardData` DTO, fully serializable, all fields primitives or plain objects:

```
DashboardData {
  overdueCount: number
  dueTodayCount: number
  priorityDistribution: { LOW: number; MEDIUM: number; HIGH: number }
  openTaskTotal: number
  recentTasks: Array<{ id, title, status, priority, dueDate: string | null, updatedAt: string }>   // ≤ 5
  generatedAt: string   // the action's `now`, for tests/debug
}
```

`dueDate`/`updatedAt` serialize as ISO-8601 strings; display formatting happens in components. No Prisma types, no `Date` instances, no user fields beyond what the view needs.

**Rationale**: Matches F005's `TaskListResult` convention (stable serializable data, predictable result). `generatedAt` makes the midnight-boundary and consistency tests deterministic (SC-002/SC-004 assert against the same instant the server used).

**Alternatives considered**:
- *Return Prisma `Task[]` for the recent list*: rejected — leaks the persistence model and violates the five-step contract's DTO-only rule.
- *Preformatted display strings from the server*: rejected — locks locale/format into the action; components own presentation.

## D5 — Jump mechanism (FR-008/FR-010 vs. F005's "criteria never in the URL")

**Decision**: A **one-shot `?seed=` parameter** on the task list route. Summary links point to `/dashboard`-external `/` (the list) with `?seed=<base64url(JSON criteria)>`, e.g. `{ "dueDate": "OVERDUE" }` or `{ "priority": "HIGH" }`. On mount the list page:
1. reads `searchParams.seed` (if absent ⇒ F005 defaults, everything unchanged),
2. decodes + validates it through the **shared `taskFilterSchema`** (Principle II / FR-010) — unknown keys, malformed values, or a failed parse ⇒ silently fall back to defaults (never an error to the user),
3. hydrates the client container with those criteria as the initial view and immediately calls `router.replace('/…')` **stripping the param**,
4. from then on the view behaves exactly like any F005 session (reload ⇒ defaults; criteria never re-enter the URL).

Only `dueDate` (preset enum) and `priority` (enum) are ever seeded — the three FR-008 jump types. Zero-count summaries are rendered as non-interactive text (no link, `aria-disabled` semantics), satisfying the not-clickable rule without dead links.

**Rationale**: F005's no-URL rule exists to keep the list view session-only; a stripped-on-mount, schema-validated, enum-only seed honors FR-008's shortcut requirement without making criteria addressable state — reload, back/forward, and sharing a link all return to defaults. Reusing `taskFilterSchema` means server-side validation is authoritative and no new validation surface is invented. Specifying that the container owns its state after hydration keeps F005's contract (initial server render is only initial data) intact.

**Alternatives considered**:
- *Direct deep-link URLs like `/?dueDate=OVERDUE`*: rejected — makes criteria URL-addressable state, violating F005's clarified rule; also allows hand-crafted criteria combos the dashboard never intends.
- *Client-side event bus / context without a URL hop*: rejected — the summary links are plain navigations between pages; there is no shared parent context across routes, and a client-side store would break the "server-rendered by default" constraint.
- *Post-message/localStorage hand-off*: rejected — fragile across tabs, untestable as an E2E navigation, and smells of state smuggling.
- *Scroll-to + filter preview inside the dashboard*: rejected — duplicates list behavior (spec US4: "the dashboard never duplicates list behavior").

## D6 — Route, navigation, and the FR-014 sign-in redirect

**Decision**: The dashboard lives at **`/dashboard`** inside the `(protected)` group (inheriting the F002 guard layers unchanged — middleware advisory check + layout `requireSession()`). Two wiring changes, both minimal:
1. **Primary navigation** (the `(protected)` layout): add a "Dashboard" link beside the existing Tasks/Categories links.
2. **Post-sign-in landing** (F002, FR-014): only the **default destination** changes — F002's "absent `?next=` ⇒ the protected area" rule becomes "absent `?next=` ⇒ `/dashboard`". Explicit `?next` handling (including its documented open-redirect posture) and the `(auth)` reverse guard are untouched.

Note: a signed-in user hitting `/` directly still sees the task list — FR-014 changes only the post-sign-in flow, not route semantics.

**Rationale**: A dedicated `/dashboard` path is clearer than overloading `/` (which is the F003–F005 task list across four features), keeps the guard inheritance free, and makes the nav link and redirect target trivial. The default-destination change is the smallest possible diff to F002's flow contract — one constant.

**Alternatives considered**:
- *Dashboard at `/` and move the list to `/tasks`*: rejected — rewrites four features' route map and the F005 contracts for no functional gain.
- *Widgets embedded in the task-list page (no new route)*: rejected — spec mandates "a dedicated view reachable from the app's primary navigation"; embedding also breaks US independence and the redirect story.
- *Redirect change in middleware instead of the sign-in flow*: rejected — middleware handles the unauthenticated redirect only; the post-login destination is the sign-in action's concern (F002 server-actions contract).

## D7 — Testing strategy (FR-013, SC-002, SC-003, SC-004)

**Decision**: Four layers, mirroring F005's test pyramid:
- **Unit** (`lib/statistics.test.ts`, Vitest): overdue/due-today/priority/recent definitions incl. completed-exclusion, no-due-date exclusion, open-only counting, tie-stable recency ordering, and the **midnight-boundary matrix** — a fixed `now` near UTC midnight (e.g. 2026-03-01T00:30Z) paired with hint zones on both sides (e.g. `Asia/Tokyo` = already next day, `America/New_York` = still previous evening), asserting where the dashboard and F005-UTC definitions agree and where they legitimately diverge. Deterministic via injected `now` and `generatedAt` (D4).
- **Component** (RTL): summary cards show counts and are non-interactive at zero; priority distribution incl. total; recent list ordering/fields/empty states; long-title truncation; a11y (labels, focus, non-color-only status/priority).
- **E2E** (Playwright): S1–S14 in quickstart.md — reflection of create/complete/delete (FR-006), all jump types pre-filling the list correctly and zero-counts not clickable (FR-008), landing on `/dashboard` after sign-in (FR-014), and the **User A/User B security scenario** (SC-003).
- **Consistency** (unit-level, part of SC-002): for a task set rendered under both calendars, assert `dashboard overdue == list OVERDUE filter count` and `dashboard dueToday == list DUE_TODAY filter count` for all same-day tasks, and assert the expected difference for the seeded boundary tasks.

**Rationale**: The spec mandates coverage per layer (FR-013) and explicitly requires automated boundary tests (FR-007/SC-002); injecting `now` into the pure module makes the midnight matrix exact rather than time-flaky. Timezone-dependent E2E assertions pin the browser's zone via Playwright's `timezoneId` context option.

**Alternatives considered**:
- *Freeze system time in unit tests instead of injection*: rejected — `vi.setSystemTime` is global and brittle; explicit injection is the F005 house pattern.
- *Skip component tests (E2E covers it)*: rejected — FR-013 mandates component tests; E2E alone gives slow, imprecise feedback.
- *Test the boundary only in E2E*: rejected — E2E can't easily fabricate "server in Tokyo, browser in New York" scenarios with controlled task data; the unit matrix does.

## Resolved unknowns summary

| Unknown | Resolution |
|---|---|
| Local-day derivation | D1 — client IANA hint, validated, UTC fallback, presentation-only |
| Query shape for <2 s | D2 — indexed count/groupBy/take-5, summary fields only |
| Computation shape | D3 — one five-step action + pure `computeStatistics` |
| DTO surface | D4 — serializable `DashboardData` incl. `generatedAt` |
| Jump mechanism | D5 — one-shot validated `?seed=`, stripped on mount, enum-only |
| Route + redirect | D6 — `/dashboard` in `(protected)`; nav link; sign-in default destination change |
| Boundary test strategy | D7 — unit midnight matrix + consistency layer + E2E |

Details: [data-model.md](data-model.md) for the computed views; [contracts/](contracts/) for the action and route contracts; [quickstart.md](quickstart.md) for validation.
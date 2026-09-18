# Quickstart / Validation Guide: Dashboard Statistics (F006)

**Feature**: `006-dashboard-statistics` | **Plan**: [plan.md](plan.md) | **Contracts**: [contracts/](contracts/)

Run the full stack (`npm run dev` + Postgres per F001 setup, seeded test users per F002) and execute S1–S14 in order. Automated equivalents: unit tests in `lib/statistics.test.ts`, component tests beside the dashboard components, Playwright E2E for the navigation/security/reflection scenarios (research D7).

## Prerequisites

- F001–F005 implemented and green (this feature composes with the F005 list, presets, and `taskFilterSchema`).
- Two seeded users, **User A** and **User B** (for S8, S13).
- Test task fixtures on User A (dates as calendar dates; adjust to the run date or inject `now` in unit tests — see D7):
  - T1 overdue open (due −2 days), T2 overdue open (due −7 days)
  - T3 completed, due last week
  - T4 open, due today; T5 open, due tomorrow
  - T6 open, no due date
  - Priorities: at least one open HIGH, one open MEDIUM, one open LOW
  - T7 with a 200-character title

## Scenarios

### US1 — Urgent counts

- **S1 Overdue excludes completed**: with T1, T2, T3 as above → dashboard overdue = **2** (T3 never counts). Then complete T1 → overdue = **1**.
- **S2 Due today**: with T4, T5 → due today = **1** (T5 excluded). Complete T4 → **0** with a calm empty state, no error.
- **S3 Empty states**: clear all overdue/due-today fixtures → both summary areas show calm empty states with a next action; nothing red or error-shaped (US1 S3, FR-004).
- **S4 No-due-date exclusion**: T6 never appears in overdue or due-today counts (F005 parity).

### US2 — Priority distribution

- **S5 Open-only counting**: seed opens across LOW/MEDIUM/HIGH + one completed HIGH → distribution shows exactly the open counts; open total = their sum; the completed HIGH is invisible to it (US2 S2).
- **S6 No open tasks**: complete everything → zeros / clear empty state with next action, no errors (US2 S3).

### US3 — Recent tasks

- **S7 Ordering + fields**: edit T5, then T1 (T1 most recent) → T1 first; each item shows title, status, priority, due date; ≤ 5 items; T7's long title truncates without breaking layout (SC-007). Ties: two tasks updated in the same second keep a stable order across reloads (spec edge case).
- **S8 Security (SC-003)**: give User B overdue + due-today + open tasks → User A's dashboard is byte-for-byte unaffected; conversely B sees none of A's tasks. No user id is ever sent from the browser (FR-005).

### US4 — Jumps (FR-008/FR-010)

- **S9 Overdue jump**: overdue = 2 → click the overdue summary → task list opens with the Overdue preset ACTIVE and exactly T1+T2 (visible in the filter bar, resettable).
- **S10 Due-today jump**: due today = 1 → click → list opens on the Due-today preset with exactly T4 (clarification 2).
- **S11 Priority jump**: click the HIGH count → list opens filtered to HIGH open-context tasks per F005's priority filter semantics.
- **S12 Zero-count not clickable**: with overdue = 0 → the overdue summary is static text (no link, not keyboard-focusable, `aria-disabled`); same for due-today/priority zeros. No dead links (FR-008).
- **S13 Seed hygiene (D5)**: after a jump, reload the list URL (param already stripped) ⇒ defaults; back/forward after a jump never resurrects seeded criteria; hand-crafting `?seed=<garbage>` ⇒ defaults, silently, and no malformed value ever reaches a query (FR-010).

### FR-014 — Landing & navigation

- **S14 Sign-in lands on dashboard**: sign in without `?next=` ⇒ `/dashboard` immediately (both users, empty or populated accounts — no task/category prerequisites). Visiting `/dashboard` signed-out ⇒ sign-in with `next=/dashboard`, and after sign-in the user returns to `/dashboard`. Captured `?next` flows (e.g. from a deep link to `/categories`) still honor `?next` as-is (F002 contract unchanged). The nav shows a Dashboard link on every protected page.

### FR-007 — Midnight-boundary consistency (automated; D7)

- **S15 Same-day agreement (SC-002)**: with hint = UTC (or any mid-day `now`), assert `dashboard overdue == list OVERDUE count` and `dashboard dueToday == list DUE_TODAY count` across the fixture set.
- **S16 Boundary divergence**: with `now = 2026-02-28T20:30Z` + hint `Asia/Tokyo`: a task due 2026-02-28 is **overdue on the dashboard** but **due today on the list**; a task due 2026-03-01 is **due today on the dashboard** but tomorrow on the list. Reverse with `America/New_York` (data-model worked example). The priority distribution is identical under all zones.
- **S17 Jump-label honesty**: around a boundary, the overdue summary's accessible label reads "open the task list's overdue view" — the possible UTC/local difference is self-explanatory, not an error.

### Non-functional

- **S18 Performance (SC-001/FR-012)**: seed 150 tasks → dashboard (counts + recent 5) renders well under 2 s; no horizontal scroll at 320/768/1280 px.
- **S19 A11y (FR-011)**: keyboard-only pass — tab through summaries, links, nav; visible focus everywhere; status/priority identified by text/icon in both themes; screen-reader labels on all summaries (count announced with its meaning).
- **S20 Reflection (FR-006)**: create → counts/list update on next view; delete a task from the list → no ghost entry in recent items; complete from the list → overdue/due-today/distribution all drop it.

## Done when

- [ ] S1–S14 pass manually or via Playwright
- [ ] S15–S17 pass as automated tests (mandatory per FR-007/SC-002)
- [ ] S18–S20 pass; unit + component suites green (FR-013)
- [ ] User A/User B isolation holds everywhere (SC-003)

Details: [data-model.md](data-model.md) for definitions and the boundary fixture; [research.md](research.md) D7 for the test strategy.
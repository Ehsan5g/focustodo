# Feature Specification: Dashboard Statistics (F006)

**Feature Branch**: `006-dashboard-statistics`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "F006 — Dashboard Statistics: Recent tasks, Overdue, Due today, Priority distribution"

## Clarifications

### Session 2026-09-17

- Q: When the dashboard counts "due today" and "overdue", which calendar's "today" should it use so its numbers agree with the task list's due-date filters (FR-007)? → A: Split calendars by design — the dashboard derives "today" and "overdue" from the user's perceived local calendar day, while the task list keeps its F005 UTC-derived windows; around-midnight boundary tasks may legitimately disagree between the two views and MUST be covered by automated tests; how the user-perceived local day is obtained is a planning decision (no per-user timezone is stored)
- Q: Should the dashboard's "due today" summary also jump to the task list when clicked, like the overdue and priority summaries do (FR-008)? → A: Yes — it jumps via F005's existing due-today preset with the same zero-count-not-clickable rule; FR-008 now covers all three count summaries
- Q: After a user signs in, should the app take them straight to the new dashboard, or keep the current post-sign-in landing and leave the dashboard reachable only from the primary navigation? → A: Yes — sign-in redirects to the dashboard (F002's post-login redirect target changes), and the dashboard is also reachable from the primary navigation; captured as FR-014

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Urgent Tasks at a Glance (Priority: P1) 🎯 MVP

A signed-in user opens their dashboard and immediately sees two numbers that demand attention: how many of their open tasks are **overdue** (due date has passed and the task is not completed) and how many are **due today**. Zero shows as a calm empty state ("nothing overdue" with a next action), not an alarming red zero. The numbers count only the user's own tasks.

**Why this priority**: Knowing what is late and what is due today is the most urgent question a personal task dashboard answers. It delivers standalone value from day one with no dependency on any other dashboard element.

**Independent Test**: Can be fully tested by creating tasks with known due dates (open and overdue, completed and past-due, due today, due tomorrow, no date), opening the dashboard, and verifying both counts are exactly correct.

**Acceptance Scenarios**:

1. **Given** open tasks due yesterday and three days ago plus a completed task due last week, **When** the user opens the dashboard, **Then** the overdue count is exactly 2 — completed tasks are never counted as overdue
2. **Given** one open task due today and one due tomorrow, **When** the user views the dashboard, **Then** the due-today count is 1 and tomorrow's task is not included
3. **Given** no overdue tasks and none due today, **When** the user views the dashboard, **Then** both summary areas show calm, informative empty states with a suggested next action, with no errors
4. **Given** another user's account holds overdue tasks, **When** the user views their dashboard, **Then** only their own tasks are ever counted

---

### User Story 2 - See Workload by Priority (Priority: P1)

The dashboard shows how the user's open (not completed) tasks break down by priority: a count for each of Low, Medium, and High, together with the total number of open tasks for context. Completed tasks are excluded so the distribution always reflects remaining work.

**Why this priority**: The priority spread is the quickest read of where effort should go next and completes, together with US1, the "what needs my attention" picture of the dashboard.

**Independent Test**: Can be fully tested by creating open tasks across all three priorities plus some completed ones, opening the dashboard, and verifying each priority count and the total.

**Acceptance Scenarios**:

1. **Given** open tasks of each priority, **When** the user views the dashboard, **Then** the distribution shows the exact count for Low, Medium, and High
2. **Given** a completed high-priority task, **When** the user views the dashboard, **Then** it does not appear in the distribution (open tasks only)
3. **Given** no open tasks, **When** the user views the dashboard, **Then** the distribution shows zero counts or a clear empty state with a next action, with no errors
4. **Given** tasks belonging to other users, **When** the user views their dashboard, **Then** none of them can affect the distribution

---

### User Story 3 - See Recent Tasks (Priority: P2)

The dashboard lists the user's most recently updated tasks — up to five, newest activity first — each showing its title, status, priority, and due date, with a link to the full task list. With fewer than five tasks it shows them all; with none it shows a welcoming empty state inviting the user to create their first task.

**Why this priority**: Recency orients the user ("what was I working on?") without hunting through the list; valuable, but secondary to the urgent counts of US1/US2.

**Independent Test**: Can be fully tested by creating and editing tasks in a known order, opening the dashboard, and verifying the recent list's ordering, shown fields, and empty/few-items states.

**Acceptance Scenarios**:

1. **Given** the user recently created and edited several tasks, **When** the user views the dashboard, **Then** the most recently updated task appears first and up to five are shown
2. **Given** the user edits a task, **When** the dashboard is viewed afterwards, **Then** that task appears at the top of the recent list
3. **Given** a task shown in the recent list, **When** the user clicks it, **Then** the task list opens where they can work with that task
4. **Given** the user has no tasks at all, **When** they open the dashboard, **Then** a welcoming empty state invites creating their first task, with no errors

---

### User Story 4 - Jump from a Summary to Its Tasks (Priority: P2)

Each summary with a non-zero count is a shortcut: clicking the overdue or due-today count opens the task list filtered accordingly (the list's existing overdue / due-today presets), and clicking a priority count opens the list filtered to that priority. Zero-count summaries are not clickable. The task list's own filters (F005) do the narrowing, so the dashboard never duplicates list behavior.

**Why this priority**: It turns passive numbers into action and composes entirely with the filtering capability that already exists — a navigation layer rather than new listing logic.

**Independent Test**: Can be fully tested by clicking each non-zero summary with known counts and verifying the task list opens pre-filtered to exactly those tasks, and that zero-count summaries are not clickable.

**Acceptance Scenarios**:

1. **Given** an overdue count of 3, **When** the user clicks the overdue summary, **Then** the task list opens showing exactly those overdue tasks
2. **Given** a high-priority count, **When** the user clicks it, **Then** the task list opens filtered to high-priority tasks
3. **Given** a summary with a zero count, **When** the user views the dashboard, **Then** that summary is not clickable
4. **Given** the user reached the list via a summary, **When** they reset filters, **Then** the full task list appears (F005 reset behavior)
5. **Given** a due-today count of 2, **When** the user clicks the due-today summary, **Then** the task list opens filtered to exactly those due-today tasks

### Edge Cases

- What happens when the user has **no tasks at all**? Every summary shows zero or an empty state and the recent list invites creating the first task; the dashboard loads without errors and makes the next step obvious.
- What happens when **all tasks are completed**? Overdue and due-today counts are 0 and the distribution shows zeros; the dashboard presents calm empty states rather than errors or alarming zeros.
- What happens with a **completed task that is due today**? It is not counted in the due-today count (open tasks only), consistent with the overdue definition.
- What happens with a **task that has no due date**? It never appears in the overdue or due-today counts.
- What happens when a **due date falls around midnight** — a different calendar day under the dashboard's local calendar versus the task list's UTC calendar? The two views may legitimately disagree by such boundary tasks; summary jumps still open the task list's corresponding filters, and automated consistency tests assert the expected boundary behavior.
- What happens when **another user's tasks exist**? No other user's tasks can ever influence any count, distribution, or list item — data is strictly per signed-in user.
- What happens with **100+ tasks** behind the numbers? Counts are computed quickly and the dashboard stays fast and readable.
- What happens when a **task is deleted while the dashboard is open**? On the next view the counts and the recent list reflect the deletion; no ghost entries remain.
- What happens with **very long task titles** in the recent list? They are truncated gracefully with the full title available on the task list; the layout never breaks.
- What happens **near midnight**? "Today" follows the user's date: the due-today boundary is the day, not the hour, and a task due today remains due today until the user's date changes.
- What happens when the dashboard is opened **directly by address while signed out**? The user is sent to sign-in first, consistent with F002 authentication behavior; no data leaks.
- What happens when **two tasks are updated at the same moment**? The recent list order remains stable and predictable rather than flickering between views.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dashboard view for the signed-in user showing an overdue count — open tasks whose due date has passed — and a due-today count — open tasks whose due date is today
- **FR-002**: The system MUST show a priority distribution counting the user's open tasks for each of Low, Medium, and High, together with the total number of open tasks
- **FR-003**: The system MUST show the user's most recently updated tasks (up to five, newest activity first), each with title, status, priority, and due date
- **FR-004**: The dashboard MUST show clear, calm empty states with a suggested next action when there are no overdue tasks, no tasks due today, no open tasks, or no tasks at all — never errors
- **FR-005**: Every dashboard number and list MUST be computed exclusively from the signed-in user's own tasks, with ownership enforced at the server boundary and the user's identity derived from the server-side session (Principle I) — a browser-supplied user identifier MUST NOT be trusted
- **FR-006**: The dashboard MUST reflect the user's current task data every time it is viewed: creating, completing, editing, or deleting tasks is accurately reflected in the counts, distribution, and recent list on the next view
- **FR-007**: Dashboard overdue and due-today counts MUST agree with the task list's matching due-date filters for every task whose due date falls in the same calendar day under both the dashboard's local calendar and the task list's UTC calendar; tasks in the around-midnight boundary (a different day under the two calendars) MAY differ between the views, and such boundary cases MUST be covered by automated consistency tests (the priority distribution is unaffected — it uses no dates)
- **FR-008**: Non-zero summaries MUST act as shortcuts: the overdue summary opens the task list filtered to overdue tasks (the list's overdue preset), the due-today summary opens it filtered to due-today tasks (the list's due-today preset), and each priority count opens the list filtered to that priority; zero-count summaries MUST NOT be clickable
- **FR-009**: Clicking a recent task MUST open the task list where the user can work with that task; the dashboard itself MUST NOT offer task editing, completing, or deleting — all task actions remain on the task list
- **FR-010**: Any filter parameters used when jumping from a summary to the task list MUST be validated before use with the same shared, validated contract the task list uses (Principle II's task filters); malformed values MUST never reach a query
- **FR-011**: The dashboard MUST be operable by keyboard with visible focus and clear labels, task status and priority MUST NOT rely on color alone, and the dashboard MUST work on desktop, tablet, and mobile without horizontal scrolling (Principle V)
- **FR-012**: The dashboard MUST remain fast and readable with 100+ tasks behind the numbers, loading in under 2 seconds under normal conditions
- **FR-013**: The feature MUST be covered by automated tests: unit tests for the statistics computation (overdue, due today, priority distribution, recency ordering, and their definitions); component tests for the summary cards, recent-task list, and empty states; end-to-end tests for the dashboard reflecting task changes and the summary-to-list jumps; and the security end-to-end test that User A's dashboard never reflects User B's tasks
- **FR-014**: The dashboard MUST be reachable from the app's primary navigation, and a signed-in user MUST land on the dashboard immediately after signing in (the F002 post-login flow redirects there); neither the landing nor the navigation link MUST require any task or category to exist

### Constraints *(user-mandated)*

- All dashboard data MUST be fetched through server actions following the five-step contract — (1) validate input, (2) authenticate the user, (3) authorize access, (4) execute business logic, (5) return a predictable result — returning stable serializable data; raw database objects MUST NOT be returned to the client
- The dashboard is read-only and server-rendered by default (Principle III); client code MUST NOT access the database directly, business logic MUST NOT live inside large components, and server actions MUST stay small and focused
- Queries behind the dashboard MUST fetch only the fields the summaries need and MUST be evaluated against the index patterns for per-user tasks by status, priority, and due date (`Task.userId`, `Task.status`, `Task.priority`, `Task.dueDate`, per Principle III)
- Any filter parameters reaching the task list from dashboard jumps MUST pass through the shared task-filters validation schema (Principle II); server-side validation is authoritative
- Builds on F001–F005 without new runtime libraries unless explicitly justified

### Key Entities *(include if feature involves data)*

- **Task**: unchanged — the dashboard is a read-only view over the user's existing tasks (status, priority, due date, creation/update timestamps); no task attributes are added or changed
- **Statistics** (not stored data): overdue, due-today, and priority counts plus the recent list are computed views over the user's tasks; no new database entities are introduced and nothing new is persisted

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The dashboard loads in under 2 seconds with 100+ tasks behind the summaries
- **SC-002**: 100% of consistency tests confirm dashboard counts match the task list for the same definitions (overdue, due today, priority) for all same-day tasks, with around-midnight boundary cases explicitly tested and their expected differences asserted
- **SC-003**: 100% of automated security tests confirm no other user's tasks can ever influence any dashboard number or list
- **SC-004**: 100% of unit tests covering the statistics computation pass, including the overdue and due-today definitions, open-task-only counting, and recency ordering
- **SC-005**: 100% of end-to-end tests pass for the dashboard reflecting task changes (create, complete, delete) and for summary-to-list jumps opening correctly pre-filtered views, including the User A / User B security scenario
- **SC-006**: A user can find out what is urgent (overdue, due today) within 5 seconds of opening the dashboard — the urgent numbers are visible immediately without scrolling or interaction
- **SC-007**: The dashboard renders correctly on desktop, tablet, and mobile with no horizontal scrolling, including with long task titles
- **SC-008**: A first-time user understands each summary without instructions; empty states make the next step obvious (create a first task, nothing is overdue)

## Assumptions

- **Dependencies**: Builds on F001 (foundation), F002 (authentication), F003 (tasks), F004 (categories), F005 (search & filters — the jump-to-filtered-list behavior composes with the task list's existing filters); category-based statistics are out of scope for v1
- **Definitions**: consistent with F003/F005 — overdue = open task with a past due date; due today = open task with today's date; both exclude completed tasks; the priority distribution counts open tasks only
- **Recency**: "recent" means most recently updated (creation or any later edit counts as activity), limited to the five most recent tasks
- **Timezone**: due dates are calendar dates without times (per F003); the task list derives its due-date windows from UTC (per F005, unchanged), while the dashboard derives "today" and "overdue" from the user's perceived local calendar day — around-midnight boundary tasks may differ between the two views (see Clarifications, 2026-09-17); how the local day is obtained is a planning decision
- **Placement**: the dashboard is a dedicated view reachable from the app's primary navigation and IS the post-sign-in landing page — after sign-in the F002 post-login flow redirects to it (see Clarifications, 2026-09-17); the dashboard's URL and navigation details remain planning decisions
- **No dashboard actions**: the dashboard is view-and-navigate only in v1 — no inline task editing, completing, or deleting; no historical trends, custom date ranges, or saved reports
- **Out of scope**: cross-user or administrative dashboards, category statistics, and exporting or sharing statistics

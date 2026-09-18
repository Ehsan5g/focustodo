# Feature Specification: Task Search & Filters (F005)

**Feature Branch**: `005-search-filters`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "F005 — Search & Filters: Search, Status, Priority, Category, Due date, Sorting, Reset filters"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search My Tasks (Priority: P1) 🎯 MVP

A signed-in user types one or more words into the search box on their task list and submits the search (by pressing Enter or activating the search control). The list then narrows to show only their own tasks whose title or description contains those words, regardless of letter case. Clearing the search box shows all of their tasks again. Search always operates only on the signed-in user's own tasks — no search can ever surface another user's tasks.

**Why this priority**: Finding a specific task by name is the single most common need once the list grows beyond a screenful; it delivers immediate value on its own and depends on no other part of this feature.

**Independent Test**: Create several tasks with known words in titles and descriptions, search for one of the words, verify only matching tasks appear, then clear the search and verify the full list returns.

**Acceptance Scenarios**:

1. **Given** the user has tasks titled "Buy groceries" and "Team meeting", **When** the user searches for "team", **Then** only "Team meeting" appears (matching ignores letter case)
2. **Given** a task whose title does not contain a word but whose description does (e.g., the description mentions "invoice"), **When** the user searches for "invoice", **Then** that task appears in the results
3. **Given** an active search showing results, **When** the user clears the search box, **Then** all of their tasks are shown again
4. **Given** another user has a task whose title matches the search text, **When** the user searches for that text, **Then** only the signed-in user's own tasks can ever appear

---

### User Story 2 - Filter by Status and Priority (Priority: P1)

A signed-in user narrows the list using two filter controls: a status filter (All / To Do / In Progress / Completed) and a priority filter (All / Low / Medium / High). Selecting either one — or both — shows only the tasks matching the chosen criteria. Setting a filter back to All removes only that restriction and leaves the others in force.

**Why this priority**: Status and priority are the two axes users organise their work by day to day; together with search they are the core of the feature.

**Independent Test**: Create tasks across all statuses and priorities, apply each filter alone and in combination, and verify the list shows exactly the matching tasks.

**Acceptance Scenarios**:

1. **Given** tasks in all three statuses, **When** the user selects "Completed", **Then** only completed tasks are shown
2. **Given** tasks with all three priorities, **When** the user selects "High", **Then** only high-priority tasks are shown
3. **Given** tasks across statuses and priorities, **When** the user selects "To Do" and "High", **Then** only tasks that are both in To Do status and high priority are shown
4. **Given** active status and priority filters, **When** the user sets priority back to "All", **Then** the priority restriction is lifted while the status filter keeps applying

---

### User Story 3 - Filter by Category and Due Date (Priority: P2)

A signed-in user narrows the list by category and by due date. The category filter offers All plus each of the user's own categories and shows only tasks in the chosen category. The due-date filter offers All / Overdue / Due today / Due this week / No due date, where a task is overdue when its due date has passed and it is not completed.

**Why this priority**: Valuable for planning, but it builds on categories (F004) and due dates (F003) that already exist; status, priority, and search cover the most frequent needs first.

**Independent Test**: Create tasks with known categories and due dates (past, today, this week, none), apply each due-date preset and category filter, and verify the list shows exactly the matching tasks.

**Acceptance Scenarios**:

1. **Given** tasks in the categories "Work" and "Errands", **When** the user filters by "Errands", **Then** only tasks in that category are shown
2. **Given** a task due yesterday that is not completed and a task due tomorrow, **When** the user selects "Overdue", **Then** only the past-due, not-completed task is shown
3. **Given** a task due today and a task due in three days, **When** the user selects "Due today", **Then** only today's task is shown; selecting "Due this week" shows both
4. **Given** tasks with and without due dates, **When** the user selects "No due date", **Then** exactly the tasks without a due date are shown, and none of the dated presets include them

---

### User Story 4 - Sort the Task List (Priority: P2)

A signed-in user reorders the visible list with a sort control: Newest first (the default), Oldest first, Due date earliest first, Priority high to low, or Title A to Z. Sorting reorders whatever list is currently shown, including results narrowed by search and filters.

**Why this priority**: Ordering helps planning, but the newest-first default of the task list already serves most cases; sorting is an enhancement to an already-usable view.

**Independent Test**: Create tasks with known creation order, due dates, priorities, and titles, apply each sort option, and verify the resulting order — including while a search or filter is active.

**Acceptance Scenarios**:

1. **Given** tasks created at different times, **When** the user sorts by "Oldest first", **Then** the earliest-created task appears at the top (the reverse of the default)
2. **Given** tasks with different due dates and some without a due date, **When** the user sorts by "Due date earliest first", **Then** the soonest due date is at the top and tasks without a due date appear last
3. **Given** tasks with different priorities, **When** the user sorts by "Priority high to low", **Then** high-priority tasks appear before medium- and low-priority ones
4. **Given** an active search narrowing the list, **When** the user changes the sorting, **Then** the narrowed set of results is reordered without widening it

---

### User Story 5 - Combine Filters and Reset (Priority: P2)

A signed-in user combines search, filters, and sorting: a task is shown only when it matches every active criterion. While any criterion is active, the interface shows how many tasks match. If nothing matches, a clear empty state says so and offers a reset control that returns the list to its defaults — all tasks, newest first.

**Why this priority**: Combination is what makes the feature genuinely useful, and reset prevents dead ends — but each individual capability (US1–US4) already delivers standalone value without it.

**Independent Test**: Apply several criteria together and verify only fully matching tasks appear, verify the match count is shown, and verify that reset restores the default full list — including from the empty-state path.

**Acceptance Scenarios**:

1. **Given** tasks matching different combinations of words, categories, and statuses, **When** the user searches "report", filters by category "Work" and status "To Do", **Then** only tasks meeting all three criteria are shown
2. **Given** active search and filters that match no task, **When** the list updates, **Then** a clear empty state says no tasks match the current criteria and offers a reset action, and the user's tasks still exist
3. **Given** active search, filters, and sorting, **When** the user chooses reset, **Then** the search box is cleared, every filter returns to All, sorting returns to Newest first, and the full task list is shown
4. **Given** an active filter combination, **When** the user creates a task that matches it, **Then** the new task appears in the filtered list; completing or deleting a matching task updates the list accordingly

### Edge Cases

- What does the list show while the user is typing in the search box but has not yet submitted? The current view stays unchanged until the search is submitted; nothing narrows mid-typing
- What happens when no task matches the active search or filters? The list shows a clear "no tasks match" empty state with a reset action; the user's tasks are never lost or hidden permanently, and no error is shown
- What happens when the search text matches a task's description but not its title? The task appears — search matches title and description alike, ignoring letter case
- What happens when the user searches for only spaces? The search behaves as an empty search and shows all tasks
- What happens when the search text contains special characters (e.g., `%`, quotes, emoji)? They are treated as plain text to match; the system never errors or crashes on them
- What about a completed task whose due date has passed? It is not counted as overdue (consistent with F003's overdue definition); it appears under the Completed status filter but not under the "Overdue" due-date preset
- What happens to tasks without a due date under the dated presets? They are excluded from Overdue / Due today / Due this week, shown only under "No due date", and placed last in due-date sorting
- What happens when a category is deleted while the user is filtering by it? The category disappears from the filter options and the list stops filtering by it, applying the remaining criteria without errors
- What happens when several tasks tie in the chosen sort (same priority, same due date, same title)? Ties break newest-first so the order is always stable and predictable
- What happens with a very long list (100+ tasks)? Searching, filtering, and sorting remain fully responsive with no visual degradation
- What if another user's tasks would match the same search or filter? They can never appear — every query is scoped to the signed-in user's own tasks regardless of criteria
- What happens after a full page reload? Search, filter, and sort selections return to their defaults (all tasks, newest first); they are view settings of the current session, not saved preferences

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a search box on the task list that narrows the list to the signed-in user's tasks whose title or description contains the searched text, ignoring letter case; an empty or whitespace-only search MUST show all tasks; the list MUST update only when the search is submitted (Enter or the search control) — not on every keystroke
- **FR-002**: The system MUST provide a status filter with the options All / To Do / In Progress / Completed, showing only tasks in the selected status when one is chosen
- **FR-003**: The system MUST provide a priority filter with the options All / Low / Medium / High, showing only tasks of the selected priority when one is chosen
- **FR-004**: The system MUST provide a category filter offering All plus each of the user's own categories, showing only tasks in the selected category when one is chosen; only the user's own categories are ever offered
- **FR-005**: The system MUST provide a due-date filter with the options All / Overdue / Due today / Due this week / No due date, where "overdue" means a task whose due date has passed and that is not completed
- **FR-006**: The system MUST combine all active criteria — search text, status, priority, category, and due date — so that a task is shown only when it matches every active criterion, with sorting applied to the combined result
- **FR-007**: The system MUST offer sorting by Newest first (the default), Oldest first, Due date earliest first, Priority high to low, and Title A to Z; ties MUST resolve newest-first, and tasks without a due date MUST sort last under due-date sorting
- **FR-008**: While any search or filter criterion is active, the interface MUST show the number of matching tasks
- **FR-009**: When no task matches the active criteria, the system MUST show a clear empty state stating that no tasks match and offering a reset action
- **FR-010**: The system MUST provide a reset control that clears the search, returns every filter to All, returns sorting to Newest first, and shows the full task list
- **FR-011**: Every list query behind search, filters, and sorting MUST enforce ownership at the server boundary: only the signed-in user's own tasks can ever be searched, filtered, counted, or returned (Principle I)
- **FR-012**: The system MUST validate all search, filter, and sort inputs before executing any query; malformed or impossible requests MUST produce a safe, predictable outcome — never a crash and never another user's data
- **FR-013**: A searched or filtered list MUST stay current: creating a task that matches the active criteria adds it to the view, and completing or deleting a matching task updates the view, so the list is never stale
- **FR-014**: The search box, filter controls, and sort control MUST be operable by keyboard with visible focus and clear labels, and the whole experience MUST work on desktop, tablet, and mobile without horizontal scrolling
- **FR-015**: The feature MUST be covered by automated tests: unit tests for search matching, filtering, and sorting logic (including the overdue definition and tie-breaking); component tests for the filter controls and empty state; end-to-end tests for search, filter, sort, reset, and task changes while filtered; and the security end-to-end test that User A cannot surface User B's tasks through any search or filter — the search/filter coverage F003 and F004 explicitly deferred to this feature

### Constraints *(user-mandated)*

- All search, filter, and sort requests MUST execute through server actions following the five-step contract (authenticate → validate → authorize → act → predictable result); server actions MUST return stable, serializable data — never raw database objects
- A shared validation schema for task filters MUST be the single source of truth between client and server (Principle II explicitly lists "task filters" among the shared schemas); client-side validation is a convenience only and server-side validation is authoritative
- Indexes MUST be evaluated against the query patterns this feature introduces — per-user tasks selected by status, priority, due date, and category (`Task.userId`, `Task.status`, `Task.priority`, `Task.dueDate`, `Task.categoryId`, per Principle III) — and queries MUST fetch only the fields the list view needs
- The list remains server-rendered by default; client interactivity is added only where it improves the experience, and client code MUST NOT access the database directly
- The feature builds on F001 (foundation), F002 (authentication), F003 (tasks with status, priority, due date), and F004 (categories) without new runtime libraries unless explicitly justified

### Key Entities *(include if feature involves data)*

- **Task**: unchanged by this feature — search and filters only read and order existing tasks (title, description, status, priority, optional due date, optional category link); no task attributes change
- **View settings** (not stored data): search text, filter selections, and sort choice are transient settings of the current page session; no new database entities are introduced

## Clarifications

### Session 2026-09-17

- Q: When the user types into the search box, should results narrow continuously while they type, or only after they pause — and if they pause, how long should that pause be before the list updates? → A: Only on submit — the list updates when the search is submitted (Enter or the search control); no per-keystroke narrowing and no debounce (FR-001)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Searching for a word among 100 tasks returns the matching results within 2 seconds under normal local conditions
- **SC-002**: Applying, changing, or clearing any filter or sort updates the visible list within 2 seconds
- **SC-003**: 100% of automated security tests confirm that no search or filter combination can ever surface another user's tasks
- **SC-004**: 100% of unit tests covering search matching, filtering, and sorting logic pass — including the overdue definition and the tie-breaking rules
- **SC-005**: 100% of automated combination tests confirm that only tasks matching ALL active criteria appear when several criteria are active together
- **SC-006**: With 100+ tasks, search, filters, sorting, and reset remain fully responsive on desktop, tablet, and mobile with no horizontal scrolling
- **SC-007**: 100% of end-to-end tests covering search, filter, sort, reset, and completing/deleting a task while filtered pass, including the User A / User B security scenario
- **SC-008**: A first-time user can find any of their tasks using search or filters without instructions; the empty state and reset control make the next step obvious without help

## Assumptions

- **Dependencies**: Builds on F001 (foundation), F002 (authentication), F003 (tasks with status, priority, and due date), and F004 (categories); this is the feature F003 and F004 pointed to for search/filter functionality and its end-to-end coverage (the constitution's overall E2E list includes search and filter)
- **Search scope**: Search matches title and description only, case-insensitively, including partial words; no search of other surfaces (none exist), no search history, no recent-search suggestions
- **Overdue definition**: Consistent with F003 — a task whose due date has passed and that is not completed; a completed task with a past due date is not overdue
- **Due-date presets**: "Due this week" means today through the next 7 days including today; fixed presets only — no custom date ranges
- **Sort defaults**: Newest first matches the F003 task-list default; ties break newest-first; due-date sorting places tasks without a due date last
- **Persistence of view settings**: Search, filter, and sort selections live only in the current page session and return to defaults on a full page reload; no saved filter presets, and filter state is not reflected in the page address (no shareable filter links)
- **Out of scope**: Cross-user or administrative views, saved views or filter presets, and any listing beyond the user's own single task list

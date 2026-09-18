# Feature Specification: Task Management (F003)

**Feature Branch**: `003-task-management`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "F003 — Task Management Create Read Update Delete Complete Status Priority Due date"

## Clarifications

### Session 2026-09-16

- Q: Once a task exists, how freely can its status change between TODO, IN_PROGRESS, and COMPLETED? → A: Forward-only lifecycle — TODO may move to IN_PROGRESS and IN_PROGRESS to COMPLETED only; reopening a completed task resets it to TODO; backward transitions are rejected with a field-level error (any valid status may still be initially set at creation per FR-001).
- Q: Is a task's due date a calendar day or a specific moment in time? → A: Date only — a calendar day without time-of-day; a task is overdue once its calendar day has passed (evaluated by calendar day, not clock time).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Task (Priority: P1)

A signed-in user creates a task by giving it a title, optionally adding a description, a due date, a priority, and a status. The new task appears in their task list immediately after saving. Invalid input is rejected with specific, field-level guidance, and nothing is saved.

**Why this priority**: A todo app begins with capturing a task; without creation, no other task capability has anything to act on.

**Independent Test**: Can be fully tested by creating a task with only a title (saved with defaults and shown in the list), then with every field filled (all values saved exactly), then with invalid submissions (rejected with clear field errors, nothing created) — delivers the capture step of the core loop.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they create a task providing only a valid title, **Then** the task is saved with default status and priority, an empty description, and no due date, and it appears in their list.
2. **Given** a signed-in user, **When** they create a task with a title, description, due date, priority, and status, **Then** every value is saved exactly as entered and displayed in their list.
3. **Given** a submission with an empty, whitespace-only, or over-length title, **When** it is processed, **Then** a specific error appears near the title field, nothing is created, and the user's other input is preserved for correction.
4. **Given** a user who submits the creation form repeatedly (double-click or resubmit), **When** the submissions are processed, **Then** at most one task is created and the outcome is consistent.

---

### User Story 2 - View My Tasks (Priority: P1)

A signed-in user sees exactly their own tasks in one list, each showing its title, status, priority, and due date (when set) at a glance. Status and priority are distinguishable without relying on color alone. Tasks belonging to other users are never visible.

**Why this priority**: Seeing the work is the reason the list exists — and this story carries the privacy guarantee that each user sees only their own data.

**Independent Test**: Can be fully tested by creating tasks for two different users and confirming each user's list shows only their own tasks with every attribute readable (including with color disabled) — delivers the privacy-scoped read view.

**Acceptance Scenarios**:

1. **Given** a signed-in user with several tasks, **When** they open their list, **Then** every task shows its title, status, and priority at a glance, plus the due date when set.
2. **Given** tasks belonging to two different users, **When** User A opens their list, **Then** only User A's tasks appear — no task of User B is ever shown.
3. **Given** the list rendering, **When** it is viewed, **Then** every task's status and priority are identifiable without relying on color alone.
4. **Given** a user with no tasks, **When** they open their list, **Then** a helpful empty state appears with a clear next action (create the first task).
5. **Given** a task whose due date has passed and that is not completed, **When** the list is viewed, **Then** the task is visibly indicated as overdue.

---

### User Story 3 - Complete and Reopen Tasks (Priority: P1)

A signed-in user marks a task complete with a single interaction, and the change is reflected immediately. Completed tasks can be reopened to a workable state. If a status change fails, the interface returns to the previous state, shows an error, and stays consistent with what the server holds.

**Why this priority**: Completing tasks is the core value loop of a todo app — the moment the product actually helps.

**Independent Test**: Can be fully tested by completing a task (status changes everywhere), reopening it (returns to a workable state), and simulating a failed change (interface rolls back and stays consistent with the server) — delivers the product's central interaction.

**Acceptance Scenarios**:

1. **Given** a task in TODO or IN_PROGRESS status, **When** the user completes it, **Then** its status becomes COMPLETED immediately in the list.
2. **Given** a completed task, **When** the user reopens it, **Then** it returns to TODO and is no longer shown as completed.
3. **Given** a status change that fails server-side, **When** it is processed, **Then** the interface rolls back to the previous state, shows an understandable error, and remains consistent with the server.
4. **Given** rapid repeated toggling of the same task, **When** the interactions settle, **Then** the displayed state matches the server state with no lost or duplicated updates.

---

### User Story 4 - Edit a Task (Priority: P2)

A signed-in user can change any field of their own task — title, description, due date, priority, status — and the saved result is shown immediately. The same validation rules apply as when creating, and cancelling an edit leaves the task untouched.

**Why this priority**: Editing keeps the list accurate over time, but the app is already usable without it; it directly extends the completed P1 core.

**Independent Test**: Can be fully tested by editing each field of an existing task (changes persist and display correctly, including across a reload), then submitting invalid edits (rejected, task unchanged), then cancelling (no change applied) — delivers long-term data accuracy.

**Acceptance Scenarios**:

1. **Given** an existing task, **When** the user edits every field and saves, **Then** the task reflects each new value immediately and the changes persist across a reload.
2. **Given** an invalid edit (empty or over-length title), **When** it is submitted, **Then** field-level errors appear and the task remains unchanged.
3. **Given** an edit that clears the description or due date, **When** it is saved, **Then** the cleared fields are removed without side effects on other fields.
4. **Given** an open edit form, **When** the user cancels, **Then** no change is applied to the task.

---

### User Story 5 - Delete a Task (Priority: P2)

A signed-in user can delete one of their own tasks. Deletion asks for explicit confirmation first so accidents are prevented; a confirmed deletion removes the task permanently, and it no longer appears in the list.

**Why this priority**: Deletion is housekeeping — a safety-valve behavior that keeps the list meaningful, but not part of the daily capture-and-complete loop.

**Independent Test**: Can be fully tested by deleting a task with confirmation (gone from the list and after a reload), cancelling a deletion (task unchanged), and acting on an already-deleted task (clear feedback, no crash) — delivers safe cleanup.

**Acceptance Scenarios**:

1. **Given** an existing task, **When** the user chooses to delete it, **Then** an explicit confirmation is requested before anything is removed.
2. **Given** a confirmed deletion, **When** it completes, **Then** the task disappears from the list and does not return after a reload.
3. **Given** a deletion prompt, **When** the user cancels, **Then** the task remains exactly as it was.
4. **Given** a task that was already deleted in another tab, **When** the user attempts to delete it again, **Then** clear feedback is shown — the action neither crashes nor affects any other task.

---

### Edge Cases

- Empty, whitespace-only, or over-length titles (beyond 120 characters): rejected with a field-level error; nothing is saved.
- Description beyond 1000 characters: constrained by the documented limit and rejected with a clear message.
- Due date in the past: accepted (users may record past obligations) and displayed as overdue — evaluated by calendar day, not clock time; no automatic status change.
- Clearing the description or due date during an edit: optional fields are removed without side effects on other fields.
- Duplicate titles: allowed — two tasks may share a title and remain independently manageable.
- Task already deleted in another tab: acting on it yields clear feedback; no crash and no effect on any other task.
- Empty list: a helpful empty state with a clear next action.
- Very large list (100+ tasks): the list remains fully usable and interactions stay responsive.
- Another user's task: every read, edit, completion, and deletion attempt is rejected server-side.
- Rapid repeated status toggling: the final displayed state matches the server state.
- Backward status transitions (e.g., IN_PROGRESS back to TODO, or COMPLETED directly to IN_PROGRESS): rejected with a clear field-level error; the task's status is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Signed-in users MUST be able to create a task providing a title (required, 1–120 characters) plus an optional description (up to 1000 characters), a due date (a calendar day without time-of-day), priority (LOW/MEDIUM/HIGH), and status (TODO/IN_PROGRESS/COMPLETED).
- **FR-002**: New tasks MUST default to status TODO and priority MEDIUM when not specified; optional fields start empty.
- **FR-003**: Task inputs MUST be validated for user convenience AND authoritatively on the server against the same documented rules; the server MUST reject invalid input regardless of what the client checked.
- **FR-004**: Users MUST see exactly their own tasks; every task read, edit, completion, and deletion MUST enforce ownership at the server boundary — a user MUST never read, modify, or delete another user's task.
- **FR-005**: Each task in the list MUST show its title, status, and priority at a glance plus its due date when set; status and priority MUST be distinguishable without relying on color alone.
- **FR-006**: Users MUST be able to edit every field of their own task; saved edits MUST persist and display immediately.
- **FR-007**: Editing MUST allow clearing optional fields (description, due date); cleared fields are removed without side effects.
- **FR-008**: Users MUST be able to mark their task completed and reopen it. Status transitions after creation MUST be forward-only: TODO may move to IN_PROGRESS, and IN_PROGRESS to COMPLETED; reopening MUST return a completed task to TODO. Backward transitions (e.g., IN_PROGRESS back to TODO, or COMPLETED directly to IN_PROGRESS) MUST be rejected with a clear field-level error. At creation, any valid status MAY be initially set (per FR-001); the forward-only rule applies to changes after creation.

- **FR-009**: Status changes MUST be reflected immediately in the interface; if a change fails, the interface MUST roll back to the previous state, show an understandable error, and remain consistent with the server state.
- **FR-010**: Users MUST be able to delete their own task; deletion MUST require explicit confirmation before removal.
- **FR-011**: Deleted tasks MUST disappear from the list and remain deleted; acting on an already-deleted task MUST produce clear feedback, never a crash.
- **FR-012**: Tasks whose due date's calendar day has passed and that are not completed MUST be visibly indicated as overdue; overdue is evaluated by calendar day (no time-of-day), never by clock time; no reminders or automatic status changes are required.
- **FR-013**: The task list MUST provide a useful empty state with a clear next action when the user has no tasks.
- **FR-014**: Task forms MUST be fully keyboard-operable with visible focus, clearly labeled fields, inline errors near the relevant field, and visible loading/success/error states; the create/edit surface MUST adapt to the device (dialog-style surface on desktop, sheet-style surface on mobile) without horizontal scrolling on any viewport.
- **FR-015**: Error messages MUST be user-friendly and understandable without technical knowledge; sensitive server or database details MUST never reach the client.
- **FR-016**: Automated tests MUST cover task creation, editing, completion, deletion, field validation limits, and the security rule that User A cannot access User B's tasks (constitution quality gates).

### Constraints *(user-mandated)*

The following come from the ratified constitution and the feature description and are treated as requirements:

- All task mutations (create, update, complete, delete) MUST go through server actions following the five-step contract: (1) validate input, (2) authenticate the user, (3) authorize access, (4) execute business logic, (5) return a predictable result — raw database objects MUST NOT be exposed to the client unnecessarily.
- Validation schemas for create task and update task MUST be the single source of truth shared between client and server (Zod, per constitution Principle II).
- Task list reads MUST fetch only the fields the interface needs; database indexes MUST be evaluated against the task query patterns (per-user, status, priority, due date) per the constitution.
- Server-rendered output by default; client interactivity only where it improves the experience, and client code MUST NOT access the database directly.
- Built on the F001 foundation stack and F002 authentication without adding new runtime libraries without documented justification.

### Key Entities *(include if feature involves data)*

- **Task**: a personal to-do item belonging to exactly one User — id, title (required, 1–120 characters), optional description (up to 1000 characters), status (TODO/IN_PROGRESS/COMPLETED), priority (LOW/MEDIUM/HIGH), optional due date (a calendar day without time-of-day), an optional category link reserved for a later feature, and creation/update timestamps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can create a task in under 15 seconds, and the task appears in their list within 2 seconds of saving under normal local conditions.
- **SC-002**: Created tasks and their edits remain intact after the user leaves and returns to the application — persistence is verified across sessions.
- **SC-003**: 100% of automated security tests confirm that User A cannot read, edit, complete, or delete User B's tasks; every such attempt is rejected server-side.
- **SC-004**: 100% of completion and reopen interactions pass automated tests, including the rollback behavior when a status change is simulated to fail.
- **SC-005**: A list of 100 tasks remains fully usable — every interaction stays responsive, and the layout shows no horizontal scrolling on desktop, tablet, and mobile viewports (verified in automated tests).
- **SC-006**: 100% of unit, component, and end-to-end tests covering create, edit, complete, delete, validation limits, and ownership pass on the completed feature.
- **SC-007**: In every automated check, task status and priority are correctly identifiable without relying on color alone.
- **SC-008** *(qualitative)*: A first-time user can create, complete, and delete a task without instructions; every error message is understandable without technical knowledge.

## Assumptions

Scope boundaries (explicitly out of scope for this feature):

- Categories and category assignment arrive with a later feature; the data model keeps an optional category link, but this feature has no category user interface.
- Searching, filtering, and sorting the task list are later features; F003 presents one list of all the user's tasks. (The constitution's overall E2E matrix mentions search/filter — that coverage lands with the feature that introduces them.)
- Reminders, notifications, recurring tasks, sub-tasks, attachments, and batch/bulk operations are not included.
- Deletion is permanent — no trash, recycle bin, or undo; confirmation guards against accidents.
- Single-user views only; there is no sharing, collaboration, or assignment of tasks between users.

Defaults chosen where the description was silent (documented for review):

- New tasks default to status TODO and priority MEDIUM; optional fields start empty.
- The list is ordered newest-created first; no ordering controls are provided in this feature.
- Reopening a completed task returns it to TODO (now a clarified requirement — see Clarifications; no longer merely a default).
- Past due dates are accepted and flagged overdue; they never change status automatically.
- Exact page addresses inside the protected area remain planning-phase decisions, consistent with F002.

Dependencies:

- Requires the F001 foundation (runnable app, data layer, quality gates) and F002 authentication (sign-in, protected area, User model). Tasks are the first per-user business data in the product.


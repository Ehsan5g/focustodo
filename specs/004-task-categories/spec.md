# Feature Specification: Task Categories (F004)

**Feature Branch**: `004-task-categories`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "F004 — Categories Create Update Delete Assign task"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Category (Priority: P1)

A signed-in user creates a named category (for example "Work" or "Errands") from a simple form. The name is required and must be between 1 and 60 characters. A category with the same name cannot be created twice by the same user. Once created, the category appears immediately in the user's category list and becomes available wherever tasks can be assigned to categories.

**Why this priority**: Categories must exist before anything can be organized with them; every other part of this feature builds on creation.

**Independent Test**: Can be fully tested by creating a category and verifying it appears in the category list and in the task assignment picker, with invalid names (empty, too long, duplicate) clearly rejected. Delivers the building block for organizing tasks.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no category named "Work", **When** they submit "Work" as a new category name, **Then** the category is created and appears in their category list and in the task assignment picker.
2. **Given** the user already has a category "Work", **When** they try to create "work" (same name, different letter case), **Then** creation is rejected with a clear message near the name field and no category is created.
3. **Given** the user submits only spaces as the name, **When** they save, **Then** the form shows an inline error that the name is required and nothing is created.
4. **Given** the user enters a name of exactly 60 characters, **When** they save, **Then** it succeeds; entering 61 characters is rejected with a clear message.

---

### User Story 2 - Assign a Task to a Category (Priority: P1)

When creating or editing a task, the user can choose one of their own categories — or leave the task without one. A task with a category shows the category's name wherever the task appears in the interface. The assignment can be changed or removed at any time by editing the task.

**Why this priority**: Assignment is the payoff of the feature — the moment categories actually organize the user's tasks. Without it, categories are only decoration.

**Independent Test**: Can be fully tested by creating a category, assigning it to a task during creation or via edit, and verifying the category name is shown on the task and can be changed or removed. Delivers the core organizing value.

**Acceptance Scenarios**:

1. **Given** the user has a category "Work", **When** they create a task and select "Work" before saving, **Then** the task appears with "Work" shown on it.
2. **Given** an existing task without a category, **When** the user edits it and selects "Errands", **Then** the task shows "Errands" immediately after saving.
3. **Given** a task assigned to "Work", **When** the user edits it and removes the category, **Then** the task shows no category and all other task details are unchanged.
4. **Given** another user also has categories, **When** the user assigns a category, **Then** only their own categories are offered, and an attempt to force-assign another user's category is rejected before any change happens.

---

### User Story 3 - Rename a Category (Priority: P2)

The user can rename one of their categories. The same naming rules apply as for creation. The new name appears everywhere the category is used: in the category list, in the assignment picker, and on every task currently assigned to it.

**Why this priority**: Renaming keeps the organization accurate as the user's needs change, but it is a maintenance action rather than part of the daily capture-and-organize loop.

**Independent Test**: Can be fully tested by renaming a category that has assigned tasks and verifying the list, the picker, and all task labels show the new name, while invalid names are rejected. Delivers lasting accuracy of the organization.

**Acceptance Scenarios**:

1. **Given** the category "Work" is assigned to three tasks, **When** the user renames it to "Deep Work", **Then** the category list, the assignment picker, and all three tasks show "Deep Work".
2. **Given** the user has a category "Errands", **When** they rename a different category to "errands", **Then** the rename is rejected with a clear message near the name field.
3. **Given** the user enters a new name of 61 characters, **When** they save, **Then** the rename is rejected with a clear message and the old name remains in place.

---

### User Story 4 - Delete a Category (Priority: P2)

The user can delete one of their own categories. Deletion asks for explicit confirmation first and clearly states what will happen: tasks assigned to the category keep all of their data and simply lose the category — they are not deleted. After a confirmed deletion, the category disappears from the category list and from the assignment picker, and its former tasks show no category.

**Why this priority**: Deletion is housekeeping that keeps the category list meaningful over time; it is destructive, so it is guarded by confirmation, but it is not part of the daily loop.

**Independent Test**: Can be fully tested by deleting a category that has tasks: the confirmation appears, cancellation changes nothing, and confirmation removes only the category while every assigned task remains intact and uncategorized. Delivers safe cleanup.

**Acceptance Scenarios**:

1. **Given** the category "Work" has two assigned tasks, **When** the user chooses to delete it, **Then** a confirmation explains that assigned tasks become uncategorized but are not deleted, and nothing is removed before the user confirms.
2. **Given** the user confirms the deletion, **When** it completes, **Then** "Work" is gone from the category list and the assignment picker, and its two tasks remain fully intact, now showing no category.
3. **Given** the user cancels the confirmation, **When** they return to the list, **Then** the category and all assignments are unchanged.

### Edge Cases

- Two categories with names differing only in letter case: creating or renaming to such a name is rejected with a clear message.
- Name boundaries: a one-character name is accepted, exactly 60 characters is accepted, 61 is rejected; whitespace-only input is rejected as empty.
- Deleting a category that has tasks: tasks are never deleted; they lose only the category assignment, and the confirmation says so beforehand.
- A category is deleted in another tab or session: the category list and assignment picker reflect it without a crash, and further actions on it give clear feedback instead of an error the user cannot understand.
- The user has no categories yet: the assignment picker shows a helpful empty state with a clear next action, and tasks work fine without any category.
- A task is being edited while its category is renamed: saving shows the current name, never an outdated label.
- Another user's category: every attempt to read, rename, delete, or assign it is rejected before any change happens.
- One category is assigned to many tasks, or its last assignment is removed: the category itself is unaffected either way.
- Many categories (50+): the category list, the assignment picker, and the task list remain fully usable and responsive.
- Very long category names on small screens: they do not break the layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A signed-in user MUST be able to create a category with a required name of 1–60 characters, evaluated after trimming surrounding spaces.
- **FR-002**: Category names MUST be unique per user — two of the user's categories MUST NOT share the same name even when letter case differs — and violations MUST be rejected with a clear message near the name field.
- **FR-003**: Every category mutation and assignment change MUST be validated authoritatively where it is executed, even when the interface has already checked the input; client-side checks are a convenience only.
- **FR-004**: Ownership MUST be enforced for every category read, mutation, and assignment: a user MUST only ever see, manage, and assign their own categories, and any attempt to touch another user's category MUST be rejected.
- **FR-005**: The category list MUST show only the current user's own categories, ordered alphabetically without regard to letter case.
- **FR-006**: A task MUST be able to belong to at most one category, chosen from the user's own categories when the task is created or edited; having no category MUST remain a valid, first-class choice.
- **FR-007**: A task's category MUST be shown as a readable name wherever the task appears; the category MUST NOT rely on color alone to be identifiable.
- **FR-008**: Changing or removing a task's category MUST give immediate feedback; if the change fails, the interface MUST roll back to the previous state, show an understandable error, and remain consistent with what the server holds.
- **FR-009**: The user MUST be able to rename their categories under the same rules as creation, and the new name MUST appear everywhere the category is used — list, assignment picker, and every assigned task.
- **FR-010**: Category deletion MUST require explicit confirmation that states assigned tasks become uncategorized and are not deleted.
- **FR-011**: After a confirmed deletion, the category MUST disappear from the category list and the assignment picker, and every formerly assigned task MUST keep all of its data and simply show no category.
- **FR-012**: When the user has no categories, the interface MUST provide a useful empty state with a clear next action.
- **FR-013**: Category forms MUST be fully keyboard-operable with visible focus, clearly labeled fields, and inline errors near the relevant field; loading, success, and error states MUST be visible, and the experience MUST adapt to the device (dialog-style surface on desktop, sheet-style surface on mobile) without horizontal scrolling on any viewport.
- **FR-014**: Error messages MUST be user-friendly and understandable without technical knowledge; sensitive server or database details MUST never reach the client.
- **FR-015**: Automated tests MUST cover category creation, renaming, and deletion, task assignment and unassignment, name validation limits, per-user uniqueness, the uncategorize-on-delete behavior, and the security rule that User A cannot access or assign User B's categories (constitution quality gates).

### Constraints *(user-mandated)*

The following come from the ratified constitution and the feature description and are treated as requirements:

- All category mutations and assignment changes MUST go through server actions following the five-step contract: (1) validate input, (2) authenticate the user, (3) authorize access, (4) execute business logic, (5) return a predictable result — raw database objects MUST NOT be exposed to the client unnecessarily.
- Validation schemas for create category and update category MUST be the single source of truth shared between client and server, as MUST the schema for task assignment changes (constitution Principle II names these explicitly).
- The Task entity keeps the optional category link it already reserves: a task belongs to one user and optionally one category, and a category belongs to exactly one user (constitution data-model contract).
- Database indexes MUST be evaluated against the actual query patterns — per-user category lookups (Category.userId) and tasks read with their category (Task.categoryId) — and queries MUST fetch only the fields the interface needs.
- Server-rendered output by default; client interactivity only where it improves the experience, and client code MUST NOT access the database directly.
- Built on the F001 foundation stack, F002 authentication, and the F003 task model without adding new runtime libraries without documented justification.

### Key Entities *(include if feature involves data)*

- **Category**: a named grouping owned by exactly one User — id, name (required, unique per user, 1–60 characters), and creation/update timestamps.
- **Task**: unchanged from F003 except that its previously reserved optional category link becomes active — a task can belong to at most one category.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can create a category in under 15 seconds, and it appears in the category list and assignment picker within 2 seconds of saving under normal local conditions.
- **SC-002**: Assigning or changing a task's category completes in under 10 seconds, and the updated category name is visible on the task immediately after saving.
- **SC-003**: 100% of automated security tests confirm that User A cannot view, rename, delete, or assign User B's categories; every such attempt is rejected server-side.
- **SC-004**: 100% of automated deletion tests confirm that every task assigned to a deleted category remains fully intact and simply shows no category.
- **SC-005**: After a rename, 100% of surfaces — the category list, the assignment picker, and every assigned task's label — show the new name.
- **SC-006**: With 50 categories and 100 tasks, the category list, the assignment picker, and the task list remain fully usable with no horizontal scrolling on desktop, tablet, and mobile viewports (verified in automated tests).
- **SC-007**: 100% of unit, component, and end-to-end tests covering the behaviors in FR-015 pass on the completed feature.
- **SC-008** *(qualitative)*: A first-time user can create a category and assign a task to it without instructions, and every error message is understandable without technical knowledge.

## Assumptions

Scope boundaries (explicitly out of scope for this feature):

- Filtering, searching, or sorting tasks by category arrive with the later filtering feature (the constitution treats task filters as their own validation surface; F003 already scoped search and filter out) — this feature only displays the assignment.
- No category counters, colors, or icons; no manual reordering of the category list.
- No shared or team categories; categories are always private to one user.
- No "uncategorized" entry in the picker as a pseudo-category; unassigned tasks simply show no category name.
- Deletion is permanent — no trash, recycle bin, or undo; confirmation guards against accidents.

Defaults chosen where the description was silent (documented for review):

- Category names are limited to 1–60 characters; the constitution fixes uniqueness per user but sets no length, and a short label keeps the list and picker layouts clean.
- Uniqueness ignores letter case, and names are trimmed of surrounding spaces before comparison and saving.
- The category list is ordered alphabetically without regard to letter case; no ordering controls are provided.
- One category per task, matching the constitution's data model.
- Renaming a category to its identical current name is a harmless no-op success.

Dependencies:

- Requires the F001 foundation (runnable app, data layer, quality gates), F002 authentication (sign-in, protected area, User model), and F003 task management (the Task entity with its reserved category link and the task create/edit surfaces this feature extends).

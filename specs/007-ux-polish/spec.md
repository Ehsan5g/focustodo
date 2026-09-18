# Feature Specification: Cross-Cutting UX Polish (F007)

**Feature Branch**: `007-ux-polish`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "F007 — UX Loading Skeleton Empty states Error states Toast Optimistic updates Responsive Dark mode"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Never Stare at a Blank Screen (Priority: P1) 🎯 MVP

While any part of the app loads its data — the task list, the dashboard, filtered or searched views — the user immediately sees skeleton placeholders shaped like the content that is coming, which then transition smoothly into the real content. Buttons and controls show a busy state while their action is in flight and cannot be triggered twice.

**Why this priority**: Perceived speed decides whether the app feels professional or broken. Without loading feedback, every feature from F002–F006 feels unreliable on a normal connection; this is the foundation the other UX stories build on.

**Independent Test**: Can be fully tested by slowing the connection, opening the task list and dashboard, and verifying placeholders appear immediately, match the final layout without jumping, and that action buttons lock while busy.

**Acceptance Scenarios**:

1. **Given** a deliberately slow connection, **When** the user opens the task list, **Then** skeleton placeholders in the shape of the incoming list appear right away and become real tasks without layout jumping
2. **Given** the dashboard is loading, **When** the user opens it, **Then** each summary and the recent-task list show placeholders until their data arrives
3. **Given** the user triggers any saving action, **When** the request is in flight, **Then** the trigger shows a busy state and further clicks are ignored until it completes
4. **Given** data that loads almost instantly, **When** the view renders, **Then** the transition is smooth with no jarring placeholder flash

---

### User Story 2 - Friendly, Recoverable Errors (Priority: P1)

Whenever something fails — a form rule, a wrong password, an expired session, a lost connection, or an unexpected server problem — the user sees a clear, human message exactly where it matters: next to the field, on the form, or as a brief notification. Technical or internal details never appear, whatever the user typed is not lost, and transient failures offer an obvious retry.

**Why this priority**: Errors are inevitable; handling them calmly is the difference between a trustworthy product and a frustrating one. The constitution makes friendly error handling with no sensitive leaks a hard requirement.

**Independent Test**: Can be fully tested by forcing each error class (invalid form, wrong credentials, server unreachable, unexpected failure) and verifying the friendly message appears in the relevant place, entered values survive, a retry recovers, and no internal details are ever shown.

**Acceptance Scenarios**:

1. **Given** a submitted form with an invalid field, **When** validation fails, **Then** a clear message appears next to that field and all entered values are preserved
2. **Given** the connection drops during an action, **When** the request fails, **Then** a plain-language message explains what happened with a retry, and no internal details are shown
3. **Given** an unexpected server failure, **When** the user hits it, **Then** they see a calm recovery message with a way forward, never a raw technical dump

---

### User Story 3 - Empty States That Guide (Priority: P2)

Every view that can be empty says so helpfully: a new account's task list invites creating the first task, a search or filter with no matches explains that and offers one-click clearing, missing categories offer creating one, and dashboard summaries show calm "all clear" messages. Empty never looks like an error or a dead end.

**Why this priority**: Empty states are where new users decide whether to continue; a dead end here loses them before the product's value shows.

**Independent Test**: Can be fully tested by visiting each surface with no data or with non-matching filters and verifying each shows its contextual empty state with a working next action.

**Acceptance Scenarios**:

1. **Given** a brand-new account, **When** the user opens the task list, **Then** an inviting empty state explains there are no tasks and offers creating the first one
2. **Given** a search or filter combination with no matches, **When** results would be empty, **Then** the empty state says nothing matched and offers clearing the search/filters in one click
3. **Given** a dashboard with nothing overdue and nothing due today, **When** the user views it, **Then** summaries show calm "all clear" messages rather than zeros that read as errors

---

### User Story 4 - Toasts Confirm Background Actions (Priority: P2)

Successful and failed background actions confirm themselves with brief, non-blocking notifications: saving or deleting a task or category, completing a task. Toasts appear briefly, dismiss themselves, stack politely, and are announced to assistive technologies without interrupting the user's focus.

**Why this priority**: Actions whose result is off-screen (deleting from a filtered list) otherwise leave users re-checking their work; toasts close the feedback loop. They layer on top of the loading and error foundations.

**Independent Test**: Can be fully tested by performing each async action with the result area out of view and verifying an appropriate toast appears, auto-dismisses, never blocks interaction, and is screen-reader announced.

**Acceptance Scenarios**:

1. **Given** the user deletes a task from a filtered list, **When** deletion succeeds, **Then** a confirmation toast appears and the task disappears from view
2. **Given** a save fails, **When** the failure occurs, **Then** an error toast states the problem in plain language and the user's input is preserved
3. **Given** several actions finish in quick succession, **When** toasts appear, **Then** they stack up to a sensible limit and never block the content the user is working with

---

### User Story 5 - Instant Task Completion (Priority: P2)

Completing a task or toggling its status updates the screen immediately — the completed appearance appears before the server confirms. If the server then rejects the change, the interface rolls back to the true state, an error message explains what happened, and the app ends up exactly consistent with the server.

**Why this priority**: Completion is the app's most repeated action; making it feel instant is the single biggest "the app respects my time" improvement. The constitution scopes optimistic updates to exactly these actions with mandatory rollback.

**Independent Test**: Can be fully tested by toggling task status against normal and forced-failure responses, verifying the immediate visual change and, on failure, the rollback plus error message ending in the server's true state.

**Acceptance Scenarios**:

1. **Given** an open task, **When** the user completes it, **Then** the completed appearance appears immediately, without waiting for the server
2. **Given** the server rejects the change, **When** the failure is detected, **Then** the task returns to its previous state and an error message explains what happened
3. **Given** a flaky connection and rapid toggling, **When** all requests settle, **Then** the final state matches the server exactly with no ghost or duplicate changes

---

### User Story 6 - Works Beautifully on Every Device (Priority: P2)

The whole app — sign-in, tasks, categories, search/filters, dashboard — adapts to desktop (sidebar navigation), tablet, and mobile (compact navigation, touch-friendly controls) with no horizontal scrolling. Creating or editing a task uses a modal on desktop and a bottom sheet on mobile, and anything the user has typed survives a layout change.

**Why this priority**: People genuinely manage tasks on phones; responsive behavior is a constitution mandate and the difference between a demo and a product.

**Independent Test**: Can be fully tested by walking the main journey (sign in, create, edit, complete, filter, dashboard) at all three device sizes and verifying layout, navigation pattern, modal vs bottom sheet, and preserved input.

**Acceptance Scenarios**:

1. **Given** desktop, tablet, or mobile, **When** the user completes the main task journey, **Then** navigation, lists, forms, and dashboard adapt correctly with no horizontal scrolling
2. **Given** a mobile device, **When** the user creates or edits a task, **Then** the form opens as a bottom sheet with comfortably sized touch controls; on desktop the same action opens as a modal
3. **Given** a half-completed form, **When** the device rotates or the window is resized, **Then** everything typed is preserved and the form adapts to the new layout

---

### User Story 7 - Light and Dark Themes (Priority: P3)

The user can switch between light and dark themes from anywhere; the choice applies instantly across the whole app, persists across sessions on their device, and a first-ever visit follows the device's system preference until the user chooses. Both themes keep sufficient contrast, and status and priority are always distinguishable without relying on color.

**Why this priority**: Dark mode is a strong preference for low-light use and a modern expectation, but the app is fully usable in a single theme — it is an additive preference layer.

**Independent Test**: Can be fully tested by toggling the theme across several views, verifying the instant app-wide switch and persistence across reopen, and checking contrast and non-color status/priority cues in both themes.

**Acceptance Scenarios**:

1. **Given** any view, **When** the user toggles the theme, **Then** the entire app switches immediately with no unstyled or inconsistent areas
2. **Given** a chosen theme, **When** the user closes and reopens the app, **Then** the choice is restored with no flash of the wrong theme
3. **Given** a first-ever visit, **When** the app loads, **Then** it follows the device's system light/dark preference until the user makes a choice

---

### Edge Cases

- What happens when the server is unreachable? A friendly "can't reach the service" message with a retry appears; any optimistic change rolls back; no raw network errors surface.
- What happens when a request fails after the interface already showed it optimistically? The change rolls back and an error appears; the final state always matches the server.
- What happens when a button is clicked twice very quickly? Only one request is processed — the busy state locks the trigger while in flight.
- What happens when many toasts fire at once? They stack up to a sensible limit, oldest dismissed first, and never block interaction.
- What happens when the device's system theme changes while the app is open? The user's explicit choice wins; only first-ever visits follow the system preference.
- What happens when a session expires mid-action? The user is guided to sign in again and returns to where they were, without losing entered data where possible.
- What happens with very long messages or task titles in toasts and errors? They truncate gracefully with the full text available in context; layouts never break.
- What happens when data loads almost instantly? Loading placeholders are flash-free: brief loads transition smoothly without a jarring skeleton flash.
- What happens when a keyboard or screen-reader user meets a toast? It is announced politely, never steals focus, and is easy to dismiss.
- What happens in dark mode to colored status and priority indicators? They remain distinguishable through non-color cues in both themes.
- What happens when a task is deleted and the deletion fails on the server? An error toast appears and the task remains in place — no silent disappearance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every data-loading surface (task list, categories, dashboard, filtered/searched views) MUST show loading placeholders shaped like the incoming content immediately while loading, transitioning smoothly to the real content with no layout jumping
- **FR-002**: Any action that talks to the server (save, delete, complete, sign in) MUST show a busy state on its trigger while in flight and MUST NOT be submittable twice during that time
- **FR-003**: Every failure — validation, authentication, authorization, not found, network, unexpected — MUST map to a clear, human-friendly message shown near the relevant field or action; sensitive server or database details MUST never be shown to the user, while useful diagnostics are logged server-side (Principle V)
- **FR-004**: Validation errors MUST appear next to the field they concern, and everything the user typed MUST be preserved when a submission fails
- **FR-005**: Transient failures (lost connection, server unavailable) MUST offer an obvious retry that completes the intended action without re-entering data
- **FR-006**: Success and failure of background actions (creating/saving/deleting tasks and categories, completing a task) MUST be confirmed with brief toast notifications that dismiss themselves, never block interaction, stack to a sensible limit, and are announced to assistive technologies without stealing keyboard focus
- **FR-007**: Completing a task and toggling its status MUST update the interface optimistically — immediately, before the server confirms
- **FR-008**: When an optimistic change fails on the server, the interface MUST roll back to the true state, show an error message, and remain exactly consistent with the server (Principle V)
- **FR-009**: Every view that can be empty MUST present a contextual empty state with a clear next action: no tasks (invite the first task), no search/filter matches (offer one-click clearing), no categories (offer creation), and calm "all clear" dashboard summaries
- **FR-010**: The app MUST offer light and dark themes, switchable from anywhere, applied instantly across the whole app; the choice MUST persist across sessions on the user's device, and first-ever visits MUST follow the device's system preference
- **FR-011**: Reopening the app MUST restore the chosen theme with no flash of the wrong theme, and both themes MUST maintain sufficient contrast with status and priority always distinguishable without relying on color alone (Principle V)
- **FR-012**: All views MUST work on desktop (sidebar navigation), tablet, and mobile (compact navigation, touch-friendly, comfortably sized controls) without horizontal scrolling; task create/edit MUST use a modal on desktop and a bottom sheet on mobile (Principle V)
- **FR-013**: Anything the user has typed MUST be preserved when the layout adapts (device rotation, window resize) or when a submission fails
- **FR-014**: The UX patterns — loading placeholders, empty states, error messages, toasts — MUST look and behave consistently across every feature surface (authentication, tasks, categories, search/filters, dashboard) as one visual language
- **FR-015**: Automated tests MUST cover the UX layer: unit tests for theme persistence and optimistic-update rollback behavior; component tests for the loading, empty, error, and toast presentations including keyboard and screen-reader behavior; end-to-end tests for the main journey under a slow network, forced failures with rollback verification, theme persistence across reload, and responsive layouts at all three device classes

### Constraints *(user-mandated)*

- Optimistic updates are used only where they improve UX — completing a task, toggling status; on failure the UI MUST roll back, show an error, and stay consistent with the server (Principle V, verbatim scope)
- Loading states and success feedback MUST be visible for async operations; errors (validation, authentication, authorization, database, not found, network, unexpected) MUST map to user-friendly messages; sensitive server/database details MUST never reach the client; useful diagnostics are logged server-side (Principle V)
- Light and dark themes with the theme preference persisted across sessions (approved-stack constraints); task create/edit uses a modal on desktop and a bottom sheet on mobile; desktop sidebar navigation, tablet, and compact mobile navigation without horizontal scrolling
- Accessibility is non-negotiable: semantic HTML, keyboard navigation, visible focus states, accessible labels, form errors near the relevant field, sufficient contrast; task status and priority MUST NOT rely on color alone (Principle V)
- Any server interaction continues to follow the five-step contract — (1) validate input, (2) authenticate the user, (3) authorize access, (4) execute business logic, (5) return a predictable result; the security E2E (User A never sees User B's tasks) remains part of the quality gates; builds on F001–F006 with no new runtime libraries unless explicitly justified

### Key Entities *(include if feature involves data)*

- **Task / Category / User**: unchanged — F007 changes how the app feels, not what it stores; no attributes are added or changed on any existing entity
- **Theme preference** (not account data): a display preference persisted on the user's device across sessions, kept out of the account data model; loading indicators, empty states, and toasts are presentation states, not stored data

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of data-loading surfaces show loading feedback immediately in automated audits — zero blank screens during loading anywhere in the app
- **SC-002**: 100% of forced-failure tests confirm friendly, actionable messages, with zero sensitive or internal system details visible to the user
- **SC-003**: Completing a task appears instant to the user — the visual change is perceptible in about a tenth of a second, before the server confirms
- **SC-004**: 100% of automated failure tests confirm optimistic changes roll back correctly and end exactly consistent with the server, with an error message shown
- **SC-005**: 100% of identified empty contexts (new account, no search/filter matches, no categories, clear dashboard) show a contextual next action, verified by tests
- **SC-006**: The chosen theme persists across app restarts with no flash of the wrong theme on load, verified by automated tests
- **SC-007**: The complete main journey (sign in → create → edit → complete → filter → dashboard) passes responsive checks on desktop, tablet, and mobile with no horizontal scrolling, including with long content
- **SC-008**: Automated accessibility checks pass for keyboard operability, visible focus, labels, contrast in both themes, and non-color status/priority cues

## Assumptions

- **Dependencies**: cross-cutting polish over the existing F001–F006 surfaces (authentication, tasks, categories, search/filters, dashboard); introduces no new data features or entities
- **Optimistic scope**: only task completion/status toggling is optimistic (constitution-scoped); create, edit, and delete use visible busy states with toast confirmation instead
- **Toast defaults**: auto-dismiss after a few seconds, manual dismissal available, at most about three stacked (oldest removed first); exact timings are planning decisions
- **Theme persistence**: per device/browser rather than synced to the user's account, keeping the account data model unchanged; the storage mechanism is a planning decision; syncing the theme across a user's devices is out of scope for v1
- **Loading feel**: very fast loads may skip visible placeholders to avoid flashing; the threshold is a planning decision
- **Error taxonomy**: the six error classes (validation, authentication, authorization, database, not found, network/unexpected) each map to one friendly message pattern per the constitution
- **Out of scope**: undo/redo for destructive actions (delete keeps its existing confirmation from F003), internationalization, custom themes beyond light/dark, offline mode, and micro-animation polish

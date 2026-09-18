# Contract: Shared UX Patterns (F007)

**Feature**: `007-ux-polish` | **Date**: 2026-09-18
**Consumers**: every F001–F006 surface (authentication, tasks, categories, search/filters,
dashboard). This is the FR-014 "one visual language" contract: every surface MUST render
its loading/empty/error/toast states through these primitives and tables — no bespoke
variants.

## 1. Component contracts

### `<Skeleton />` and shape components

- Props: `className` for geometry; shape components (`TaskSkeleton`,
  `DashboardSkeleton`, form/dialog skeletons) compose it to mirror real content
  dimensions (same box model → zero layout shift, FR-001).
- Rendered by route `loading.tsx` (navigation entry, immediate) and by
  `<DelayedFallback delayMs={300}>` around streamed chunks (near-instant loads never
  flash — resolved default D1).
- Decoration only: `aria-hidden`, excluded from the accessibility tree.

### `<BusyButton />`

- Props: `pending: boolean`, `pendingLabel?: string`, regular button props.
- While `pending`: disabled, `aria-busy="true"`, shows `pendingLabel` (default
  "Working…"); pointer and keyboard re-submission impossible (FR-002). Focus is kept on
  the trigger while disabled.
- MUST wrap every trigger that talks to the server (save, delete, sign in/out,
  complete when not on the optimistic path, clear-filters).

### Toast API (`ToastProvider` + `toast()`)

- `toast({ title, description?, variant: "success" | "error", retry?: () => void })`.
- Viewport: bottom-right (top on mobile), `role="status"` wrapper,
  `aria-live="polite"`, `aria-atomic="true"`; toasts announced on insert, never
  focused (FR-006).
- Timers: auto-dismiss 4 s (success) / 7 s (error); timer pauses while hovered or
  focused; manual dismiss button on every toast; stack cap 3, oldest removed first.
- `retry` present ⇒ error toast keeps a visible "Retry" button that re-invokes the
  original action (input/action context preserved, FR-005).

### `<EmptyState />`

- Props: `icon`, `title`, `description?`, `action?: { label, onClick | href }`.
- Exactly one primary action (FR-009); inventory + canonical copy:

| Context | Title | Primary action |
|---------|-------|----------------|
| No tasks yet | "No tasks yet" | "Create your first task" → opens TaskFormDialog |
| Search/filter no match | "No matching tasks" | "Clear search & filters" → `router.replace` with params stripped |
| No categories | "No categories yet" | "Create a category" |
| Dashboard overdue+today = 0 | "You're all clear" | none (calm message, no action — reads as success, not zero) |
| Dashboard recent empty | "Nothing here yet" | "Create a task" |

### `<ErrorMessage />`

- Props: `error: UxError` (below), `onRetry?`. Two presentations: field-level
  (`role="alert"`, linked to input via `aria-describedby`, appears directly under the
  field) and surface-level (form/banner).
- MUST show `error.title` (+`error.description` when present) verbatim from the
  taxonomy; MUST NOT render any server-provided string not in the taxonomy (FR-003).
- Input preservation: on any failed submission, every controlled input keeps its value
  (FR-004/FR-013) — validated by component tests.

### `UxError` (the taxonomy type) — canonical table

| Result kind | target | retryable | title | description |
|-------------|--------|-----------|-------|-------------|
| validation_error (field) | field | no | Zod-mapped message | — |
| validation_error (form) | form | no | "Check the highlighted fields" | "Fix the errors below and try again." |
| unauthenticated | toast → redirect | no | "Please sign in again" | "Your session ended. Sign in to continue." |
| forbidden | toast | no | "You don't have access" | "This item isn't available to you." |
| not_found | toast | no | "Item not found" | "It may have been deleted. Refresh to see the current list." |
| network / server_error / unexpected | toast | yes | "Something went wrong" | "We couldn't complete that. Your changes are safe — try again." |

Rules: mapping is total over the F003 result kinds + client network failure; DB
internals, stack traces, query text, session/token values are never rendered
(Principle I); the same failure class produces identical copy on every surface
(FR-014). Server-side diagnostics: the action's existing logging (unchanged) carries
the technical detail.

### Optimistic task toggle (client contract around the unchanged server action)

- Trigger: task status control (complete / TODO / IN_PROGRESS) — the ONLY optimistic
  surface (spec Constraint).
- Sequence: paint pending status immediately (≤100 ms, SC-003) → invoke the existing
  `toggleTaskStatus` server action → on success commit the returned authoritative
  status (+ success toast) → on failure roll back to returned server status +
  retry-able error toast (FR-007/FR-008).
- Rapid toggles: actions queue serially; final rendered state ≡ server state exactly —
  no ghost or duplicate changes (US5 scenario 3). Unit-tested (FR-015).
- Create/edit/delete: NEVER optimistic — busy-button during flight + toast on result.

### `<TaskFormDialog />` (desktop modal / mobile bottom sheet, one component)

- Same mounted instance across breakpoints; presentation is CSS/media-query driven:
  centered modal with overlay at ≥768 px, bottom-anchored slide-up sheet below (FR-012).
- Both presentations share one a11y contract: `role="dialog"`, `aria-modal="true"`,
  accessible title, initial focus, focus trap, Esc closes, focus returns to trigger.
- Form state lives inside the instance → rotation/resize preserves everything typed
  (FR-013); failed submission preserves values and shows field-level errors (FR-004).
- Reused for category create/edit (FR-014).

### Theme (contract around `ThemePreference`, data-model.md)

- Storage: `localStorage["focustodo-theme"]` ∈ {light, dark, system}; corrupt/unknown →
  system; absent → system (first visit follows OS, FR-010).
- No-flash: inline `<head>` script (runs pre-paint) resolves + applies `class="dark"`
  to `<html>`; `ThemeProvider` hydrates from the applied state and owns instant
  app-wide switching, persistence, and live `matchMedia` updates in system mode
  (FR-011, SC-006).
- Toggle available from anywhere: desktop sidebar + compact mobile nav (FR-010).
- Both themes: ≥WCAG AA contrast; status/priority identified by text labels + icons —
  never color alone (Principle V, FR-011).

### Responsive shell

| Class | Range | Navigation | Notes |
|-------|-------|------------|-------|
| Desktop | ≥1024 px | Fixed sidebar | Full labels, theme toggle inline |
| Tablet | 768–1023 px | Collapsible icon-only sidebar | Full labels on hover/expand |
| Mobile | <768 px | Compact top nav | Touch targets ≥44 px, primary actions first |

No horizontal scrolling at 360 / 768 / 1280 px including long titles/descriptions
(verified by E2E, SC-007). Server data only in server components; nav interactivity
(sections, drawer) is the shell's only client JS.

## 2. Consistency guarantees (FR-014 verification hooks)

- Every surface imports the same primitives; ESLint rule-of-thumb documented in
  tasks: no surface may hand-roll spinner/empty/error/toast markup.
- Copy tables above are the single source for user-facing UX strings.
- Component tests assert the shared primitives render identically per surface context
  (same test helpers reused across tasks/categories/dashboard/auth suites).

## 3. Accessibility contract (non-negotiable, Principle V)

- Semantic HTML landmarks per surface; visible focus states; keyboard operability for
  every interactive element incl. toasts (dismiss/Retry reachable, non-blocking).
- Form errors: `role="alert"` + `aria-describedby` bound to the field.
- Loading: `aria-busy` on busy triggers; skeletons decorative; route-level announcements
  via document title updates are out of scope for v1.
- Toasts: polite live region, no focus steal (FR-006).
- Status/priority: text + icon cues in both themes (never color-only).

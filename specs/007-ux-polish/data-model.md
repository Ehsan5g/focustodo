# Data Model: Cross-Cutting UX Polish (F007)

**Feature**: `007-ux-polish` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

## Database changes

**None.** F007 adds no tables, columns, indexes, or migrations. `Task`, `Category`,
`User`, and all relations from F001–F006 are untouched (spec Key Entities: "F007 changes
how the app feels, not what it stores").

## Domain entities (unchanged, for reference)

| Entity | Fields | Notes for F007 |
|--------|--------|----------------|
| User | id, name, unique email, passwordHash, createdAt, updatedAt | No theme field — theme is explicitly NOT account data |
| Task | id, userId, title, description?, status, priority, dueDate?, categoryId?, createdAt, updatedAt | `status` (TODO/IN_PROGRESS/COMPLETED) is the only field optimistic UI touches; every mutation stays server-validated |
| Category | id, userId, name (unique per user), createdAt, updatedAt | Toast + dialog/sheet wrap existing create/edit/delete actions |

## Presentation-state model (new, client-side only — not persisted server-side)

### ThemePreference

| Field | Type | Values / Rules |
|-------|------|----------------|
| key | const | `"focustodo-theme"` (localStorage) |
| stored | `"light" \| "dark" \| "system"` | Default `"system"` when key absent/corrupt — first-ever visit follows OS preference (FR-010) |
| resolved | `"light" \| "dark"` | `system` → `matchMedia("(prefers-color-scheme: dark)")`; live-updates while in `system` mode (D5) |

State transitions: `absent → system → (user picks) light|dark → persisted across
sessions → re-resolved before first paint by the inline <head> script (no wrong-theme
flash, FR-011)`. Validation: unknown stored values fall back to `system` (never throw).

### Toast

| Field | Type | Rules |
|-------|------|-------|
| id | `string` | Unique per toast (insertion counter) |
| variant | `"success" \| "error"` | Drives color + icon; announced via `aria-live="polite"` region |
| title / description | `string` | Copy always from `lib/ux/toast-messages.ts` (FR-014); never contains server internals |
| retryAction? | `() => void` | Present only on retryable errors (FR-005); button re-runs original action, input preserved |
| createdAt | `number` | Eviction + timer ordering |

Lifecycle: `inserted → visible (aria-live announce, no focus steal) → auto-dismiss 4 s
(success) / 7 s (error) → removed`; timer pauses while hovered/focused; manual close
always available; stack cap 3, oldest removed first (D3). On rapid multi-action bursts
toasts queue into the cap — they are ephemeral presentation, never state.

### BusyAction (transient, per trigger)

| Field | Type | Rules |
|-------|------|-------|
| label | `string` | Visible busy label while in flight (FR-002) |
| pending | `boolean` | Trigger disabled + non-reentrant for the whole flight (no double submit) |

### OptimisticToggle (transient, per task item)

| Field | Type | Rules |
|-------|------|-------|
| pendingStatus | `Task["status"]` | Painted immediately (≤100 ms, SC-003) |
| serverStatus | `Task["status"]` | Authoritative value from the action's result |

Transitions: `idle → pending(paint pendingStatus) → committed(serverStatus) | rolled
back (paint serverStatus, show retry-able error toast)`; serial queue for rapid
toggles; after settle, UI state ≡ server state exactly (FR-008, US5 scenario 3).

### UXState (per loading surface)

`idle | loading (skeleton shown after 300 ms fallback threshold) | empty (contextual
EmptyState) | error (friendly + retry) | ready`. Every data surface implements the full
set (Principle V DoD); `loading.tsx` covers navigation-entry loading, Suspense fallbacks
cover streamed chunks.

## Validation rules (from requirements)

- Theme: only the three stored values accepted; anything else → `system`.
- Toast copy: must map from the error taxonomy / canonical message table — no
  free-form server text may reach the viewport (FR-003).
- Empty states: exactly one primary action each (FR-009, D7).
- Optimistic scope: completion + status toggle ONLY; create/edit/delete remain
  busy-button + toast (spec Constraint, verbatim).
## Relationships

```text
User 1──* Task ──? Category          (F001–F006, unchanged)
User ── (device-local) ThemePreference   ← not a DB relation; localStorage only
Surface ── UXState                    (one per data-loading surface)
Action ── BusyAction + Toast          (one trigger → one busy state; N toasts over time)
TaskItem ── OptimisticToggle          (one in-flight toggle per item at a time)
```

## FR → model traceability

| FR | Model element |
|----|---------------|
| FR-001 | `UXState.loading` + skeleton primitives (D1) |
| FR-002 | `BusyAction` |
| FR-003/004/005 | Error taxonomy (`data` in contracts/ux-patterns.md), field vs form vs toast `target`, `retryAction` |
| FR-006 | `Toast` |
| FR-007/008 | `OptimisticToggle` |
| FR-009 | Empty-state inventory (D7) |
| FR-010/011 | `ThemePreference` |
| FR-012/013 | Responsive shell + `TaskFormDialog` single-instance CSS adaptation (D6) |
| FR-014 | Shared primitives + canonical copy tables |
| FR-015 | Test matrix (D8, quickstart.md) |

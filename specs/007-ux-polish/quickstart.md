# Quickstart: Cross-Cutting UX Polish (F007)

**Feature**: `007-ux-polish` | **Date**: 2026-09-18
**Purpose**: runnable validation proving each FR/SC without duplicating contracts —
refer to [contracts/ux-patterns.md](./contracts/ux-patterns.md) for exact copy/tables
and [data-model.md](./data-model.md) for state transitions.

## Prerequisites

- F001–F006 implemented (sign-in, tasks CRUD + toggle, categories, search/filters,
  dashboard all reachable), app runs per root README local-development steps.
- Playwright device descriptors: Desktop 1280×720, Tablet 768×1024, Mobile 375×667
  (portrait) + landscape 667×375 for rotation.
- Forced-failure harness: Playwright route interception (abort/500) on server-action
  endpoints; slow-network via `CDP` throttling or route delay.

## Commands

```bash
npm run test:unit          # Vitest — theme, taxonomy, toast reducer, optimistic reducer
npm run test:component     # RTL — primitives + a11y behavior
npm run test:e2e           # Playwright — journeys below
npm run typecheck && npm run lint   # gates before any commit
```

## A. Foundations (US1 — skeletons, busy locks) → FR-001, FR-002, SC-001

- **S1 Slow task list**: throttle to slow 3G, sign in, open tasks → shaped list
  skeleton paints immediately, becomes real rows with zero layout jump.
- **S2 Slow dashboard**: open dashboard on throttled network → each summary card and
  recent-list show placeholders until data arrives (SC-001).
- **S3 Fast load no flash**: normal connection → skeleton either skipped (≤300 ms
  chunks) or indistinguishably brief; no jarring flash (US1 scenario 4).
- **S4 Busy lock**: double-click Save / Delete / Sign-in rapidly during flight →
  exactly one request fires; trigger shows busy label + `aria-busy` (FR-002).

## B. Errors (US2) → FR-003, FR-004, FR-005, SC-002

- **S5 Field validation**: submit task form with empty title (>120 chars too) →
  friendly message under the field (`aria-describedby`), all typed values intact.
- **S6 Wrong credentials**: sign in with bad password → calm form-level message, no
  server/db detail anywhere in DOM (SC-002), email preserved.
- **S7 Connection drop**: intercept and abort the save request → retry-able "Something
  went wrong" toast; clicking Retry completes the action without re-entering data
  (FR-005).
- **S8 Unexpected server failure**: intercept with 500 on dashboard load → app-level
  friendly boundary with recovery path; raw stack/query text never rendered.
- **S9 Not found**: open a deleted task's URL → "Item not found" message + way back;
  list refresh shows current truth.

## C. Empty states (US3) → FR-009, SC-005

- **S10 New account**: fresh user opens tasks → inviting "No tasks yet" + "Create your
  first task" action opens the dialog (SC-005).
- **S11 No matches**: search gibberish / filter combination with zero hits → "No
  matching tasks" + one-click "Clear search & filters" restores default list.
- **S12 No categories**: open categories with none → "No categories yet" + create
  action.
- **S13 Calm dashboard**: zero overdue/today → summary shows "You're all clear"
  (not zeros that read as errors); recent list empty → create pointer.

## D. Toasts (US4) → FR-006, SC-002

- **S14 Delete from filtered list**: delete a task → success toast appears while the
  list updates; auto-dismisses after ~4 s; never blocks interaction; announced in the
  polite live region (no focus steal).
- **S15 Failed save**: force save failure → error toast in plain language, form values
  intact, Retry available.
- **S16 Stacking**: trigger three quick actions → at most 3 toasts, oldest evicted,
  content never obscured; manual close works on each.

## E. Optimistic completion (US5) → FR-007, FR-008, SC-003, SC-004

- **S17 Instant complete**: click complete on a task → checked/strikethrough appearance
  paints immediately (≤100 ms, before server confirms) (SC-003).
- **S18 Forced-failure rollback**: intercept toggle with failure → UI returns to prior
  status, error toast explains, final UI state ≡ server state (verify by reload)
  (SC-004).
- **S19 Rapid toggles**: complete/undo/complete on flaky connection → after all settle,
  exactly the server's final status; no ghost or duplicate rows (US5 scenario 3).
- **S20 Scope guard**: create/edit/delete remain busy+toast (never optimistic) —
  component-level check.

## F. Responsive (US6) → FR-012, FR-013, SC-007

- **S21 Three classes, full journey**: run sign in → create → edit → complete →
  filter → dashboard at Desktop/Tablet/Mobile → correct nav per class (sidebar /
  icon sidebar / compact nav), no horizontal scrolling at 360/768/1280 px including
  a 120-char title and 1000-char description (SC-007).
- **S22 Modal vs sheet**: create task at desktop → centered modal; at mobile →
  bottom sheet; both trap focus, close on Esc, return focus to trigger (FR-012).
- **S23 Input survives adaptation**: half-filled task form, rotate device / resize
  across the 768 px boundary → every typed value + validation message preserved
  (FR-013).

## G. Theme (US7) → FR-010, FR-011, SC-006, SC-008

- **S24 Toggle anywhere**: switch theme from desktop sidebar and from compact mobile
  nav → whole app (auth pages included) switches instantly, no unstyled areas.
- **S25 Persistence + no flash**: choose dark, close app, reopen → dark restored with
  no flash of light (assert via Playwright beforeunload/reload + paint probe)
  (SC-006).
- **S26 First visit**: clear storage, OS in dark mode → app renders dark on first
  paint (system default, FR-010).
- **S27 Both-theme contrast**: automated a11y pass (axe) at both themes → contrast
  ≥AA; status/priority identifiable via text+icon with color perception removed
  (SC-008, Principle V).

## H. Regression gates

- **S28 Security**: User A cannot access User B's tasks after refactor (existing F002/
  F003 security E2E stays green — spec Constraint).
- **S29 Five-step contract**: all existing action unit/E2E suites for F002–F006 pass
  unchanged (contracts/server-actions.md §Verdict).
- **S30 Keyboard + reader sweep**: full keyboard traversal of tasks/dashboard/toasts;
  screen-reader smoke: toasts announced politely, busy triggers expose `aria-busy`,
  form errors announced (`role="alert"`), skeletons silent.

## Definition of validated

All scenarios S1–S30 green + `typecheck`/`lint` clean + no new runtime dependency in
`package.json` + zero Prisma schema drift = F007 Definition of Done (Principle V DoD:
loading, error, empty, success handled on every surface).

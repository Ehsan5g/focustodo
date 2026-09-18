# Research: Cross-Cutting UX Polish (F007)

**Feature**: `007-ux-polish` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

Scope: resolve every planning-level unknown in the spec's documented defaults (skeleton
flash threshold, toast timings/stacking, theme storage mechanism, breakpoints) plus the
technical approach for each UX system. Research is grounded in the constitution
(no new runtime libraries; native React/Next capabilities preferred) and the F001–F006
contracts this feature polishes.

## D1 — Loading: route-level skeletons + delayed fallbacks

**Decision**: Next.js route-level `loading.tsx` per `(app)` segment (tasks, categories,
dashboard) rendered by Suspense during navigation, plus a small client `DelayedFallback`
wrapper (300 ms) for streamed in-page chunks so near-instant loads never flash a skeleton.
Skeletons are shape-mirrors of the real content (identical box model: same card/row
heights, paddings, gaps) so the skeleton→content swap has zero cumulative layout shift.

**Rationale**: Server-first loading needs no client JS for the common case (constitution
Principle III); the 300 ms delayed fallback implements the spec's documented default
("very fast loads may skip visible placeholders to avoid flashing") at the only place
timing matters. Route-level files guarantee FR-001 "immediately" on navigation — the
placeholder paints with the frame, not after data arrives.

**Alternatives considered**: (a) global spinner — rejected: fails "shaped like the
incoming content"; (b) per-component client loading state — rejected: forces client
components where server components suffice; (c) skeleton always visible even for <50 ms
loads — rejected by spec's flash-avoidance clause.

## D2 — Error taxonomy: map the five-step result kinds to six friendly classes

**Decision**: A single typed map `lib/ux/error-taxonomy.ts`: server action result kinds
(validation_error, unauthenticated, forbidden, not_found, server_error) plus client-side
network failures map to `{ title, description, retryable, target: "field" | "form" | "toast" }`.
Field-level messages come from Zod issue paths (client Zod first for instant feedback,
server Zod authoritative). Network/unexpected and server_error → retryable, with the
original action re-invoked (FR-005: no data re-entry). DB internals, stack traces,
query text, and session/token material are never mapped into copy; they go to
server-side diagnostics logs only (FR-003, Principle V).

**Rationale**: Reuses the F003 five-step contract as-is — F007 adds zero new server
result kinds, so the taxonomy is purely a presentation-layer concern. One map per class
satisfies FR-014 (consistent language across surfaces).

**Alternatives considered**: (a) pass server exception messages through — rejected:
leaks internals (Principle I); (b) per-surface ad-hoc strings — rejected: FR-014
consistency and double maintenance.

## D3 — Toasts: minimal custom manager, no new dependency

**Decision**: A ~120-line client toast manager: `ToastProvider` (context + `useReducer`)
mounting one viewport portal with `role="status"` / `aria-live="polite"`; API
`toast({ title, description?, variant: "success" | "error" })`. Parameters: auto-dismiss
**4 s** (success) / **7 s** (error, retry-able ones keep the retry button), pause timer
while hovered/focused, manual close button on each toast, stack cap **3** with oldest
removed first, toasts never take focus (FR-006) and are announced once on insert.

**Rationale**: The spec forbids new runtime libraries unless justified; React context +
portal covers stacking, timing, and a11y with no dependency and full control over the
"announced without stealing focus" requirement. Toast copy comes from
`lib/ux/toast-messages.ts` (FR-014 consistency).

**Alternatives considered**: (a) `sonner` — rejected: new dependency; (b) shadcn/ui
Toast recipe — rejected: ~3× the code (Radix primitive copy) for the same behavior, and
upstream has deprecated it in favor of sonner; (c) inline per-surface notices —
rejected: fails the "background actions confirm themselves" pattern.

## D4 — Optimistic completion: `useOptimistic` + serial transitions

**Decision**: `TaskItem` holds the list's rendered truth; completing/toggling uses
React 19 `useOptimistic` inside `startTransition` around the existing F003 server action
(`toggleTaskStatus`), so the completed appearance paints immediately (SC-003 ≤100 ms).
The action returns the authoritative row state; on failure the transition settles back
to server truth (automatic rollback), and a retry-able error toast explains it
(FR-008). Rapid toggling queues actions serially — every request carries `id + intended
status`, results apply in order, and the final render equals the server's final state
(no ghost/duplicate changes). **Scope guard**: optimistic path is implemented only in
the task status control; create/edit/delete keep busy-button + toast (spec Assumption).

**Rationale**: Native primitive, purpose-built for exactly this rollback semantics;
keeps the five-step contract untouched (the server action still validates/authenticates/
authorizes and re-reads the row). Alternative state juggling is error-prone and
violates III's simplicity bar.

**Alternatives considered**: (a) TanStack Query cache mutations — rejected: new
dependency + introduces a second data layer beside Server Components; (b) manual
`useState` snapshot/restore — rejected: hand-rolled rollback is where "exactly
consistent with server" bugs live; (c) optimistic create/delete — rejected: outside
the constitution's verbatim optimistic scope.

## D5 — Theme: custom provider + inline no-flash script, device-local

**Decision**: `lib/theme.ts` owns a single storage key `focustodo-theme`
(`"light" | "dark" | "system"`). A tiny **inline script rendered in `<head>`** runs
before first paint: read the key → resolve (`system` follows `matchMedia("(prefers-color-scheme: dark)")`)
→ set `class="dark"` on `<html>` — eliminating any wrong-theme flash (FR-011, SC-006).
`ThemeProvider` (client) then takes over: instant class swap on toggle, persistence to
`localStorage`, live `matchMedia` listener while in `system` mode, and hydration-safe
state (reads the class the script already applied). Palette source: Tailwind `dark:`
variants + CSS custom-property theme tokens; both themes keep ≥WCAG AA contrast and
status/priority stays distinguishable via text labels + icons, never color alone
(FR-011, Principle V).

**Rationale**: This is the standard, minimal no-flash pattern (~50 lines total);
FR-010's "first-ever visits follow system preference" and "persist on device" map 1:1
to storage + matchMedia with zero schema impact (Key Entities: theme is NOT account
data). No server round-trip, no cookie, works on signed-out pages too.

**Alternatives considered**: (a) `next-themes` — rejected: new dependency for logic we
can own in ~50 lines (constitution: no unnecessary libraries); (b) cookie-backed theme
— rejected: needs server plumbing and syncs nothing the spec wants (explicitly
per-device); (c) media-query-only — rejected: cannot honor a manual choice (FR-010).

## D6 — Responsive shell + dialog/bottom-sheet as one adaptive component

**Decision**: Breakpoints: **desktop ≥1024 px** (fixed sidebar navigation), **tablet
768–1023 px** (collapsible icon-only sidebar), **mobile <768 px** (compact top
navigation with primary actions; touch targets ≥44 px). `TaskFormDialog` is ONE client
component whose presentation is CSS/media-query driven: dialog (centered, overlay) at
≥768 px, bottom sheet (bottom-anchored, slide-up) below. Because the component instance
is not remounted at the breakpoint boundary, all form state (draft fields, validation
messages) survives rotation/resize — FR-013 by construction. Same dialog/sheet contract
is reused by category create/edit (FR-014 consistency). Shell and dialogs are verified
for no horizontal scrolling at 360 / 768 / 1280 px widths with long content.

**Rationale**: CSS-driven (not JS-mounted) adaptation is the only way to guarantee
"anything the user has typed is preserved when the layout adapts" without state
bridging; a single component with two presentations keeps FR-014's one visual language
and honors Principle V verbatim (modal desktop / bottom sheet mobile).

**Alternatives considered**: (a) two components swapped by `matchMedia` — rejected:
remount destroys form state; (b) route-based create/edit pages kept — rejected: spec
mandates modal/sheet; F003 pages become trigger shells; (c) viewport-width JS listeners
driving layout — rejected: CSS handles it with no hydration cost.

## D7 — Empty-state inventory and one-click recovery

**Decision**: One `EmptyState` primitive (icon + title + description + exactly one
primary action). Inventory: (1) zero tasks → "Create your first task"; (2) search/filter
no match → "Clear search & filters" (one click: `router.replace` with params stripped —
restores F005's default Newest-first view); (3) zero categories → "Create a category";
(4) dashboard overdue/today zero → calm "all clear" message in the summary cards (not a
zero that reads as an error); (5) dashboard recent-5 empty → pointer to create. All
five are component-testable in isolation (FR-015).

**Rationale**: The spec names exactly these contexts (FR-009, US3 scenarios); a single
primitive guarantees identical look/behavior (FR-014) and keeps each state a leaf
component under Principle III.

**Alternatives considered**: (a) bespoke per-surface blocks — rejected: drift; (b)
suggesting "undo filters" as a second action — rejected: one clear primary action per
the spec's "clear next action" language.

## D8 — Test strategy for the UX layer (FR-015)

**Decision**: Three tiers, all test-first where practical:
- **Unit (Vitest)**: theme resolve/persist/inline-script output; error-taxonomy mapping
  (every result kind → expected copy/`retryable`/`target`, and assert no mapping emits
  server detail); toast reducer (stack cap, oldest-evicted, timers); optimistic toggle
  reducer (immediate paint, failure → exact prior state, serial rapid toggles).
- **Component (RTL)**: skeleton renders match content geometry (no layout jump);
  busy-button disables during flight; toast stack + `aria-live` + no focus steal;
  empty states (each inventory item) + one-click clear; field-level errors preserve
  typed input; dialog/sheet a11y (role, label, focus trap, Esc) in both presentations;
  theme toggle swaps class + persists.
- **E2E (Playwright)**: main journey under throttled network (skeletons appear, no
  blank screen); forced-failure toggles → rollback + error + final server consistency;
  theme persists across reload with no flash; responsive checks at 3 device classes
  incl. no-horizontal-scroll and modal-vs-sheet; existing security E2E (User A never
  sees User B's tasks) stays green.

**Rationale**: Maps 1:1 onto FR-015's mandated coverage list; the unit tier keeps
rollback and taxonomy logic cheap to verify before any browser runs.

**Alternatives considered**: (a) E2E-only coverage — rejected: slow and flaky for
logic like rollback; (b) visual-regression tooling — rejected: out of scope for v1
(spec excludes micro-animation polish; Playwright screenshot diff for the shell can
come later if needed).

## Resolved planning defaults (from spec Assumptions)

| Default | Resolved value | Decision |
|---------|----------------|----------|
| Skeleton flash threshold | 300 ms delayed fallback (route `loading.tsx` paints immediately on navigation) | D1 |
| Toast auto-dismiss | 4 s success / 7 s error (paused on hover/focus) | D3 |
| Toast stack limit | 3 concurrent, oldest removed first | D3 |
| Theme storage | `localStorage` key `focustodo-theme`, device-local, `system` default | D5 |
| Breakpoints | <768 mobile / 768–1023 tablet / ≥1024 desktop; dialog ≥768 px, sheet below | D6 |
| Toast retry nuance | error toasts keep visible retry until dismissed | D2 + D3 |

All spec `[NEEDS CLARIFICATION]` markers: none existed; none introduced.

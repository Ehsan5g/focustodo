# Implementation Plan: Cross-Cutting UX Polish (F007)

**Branch**: `007-ux-polish` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-ux-polish/spec.md`

## Summary

Apply one consistent UX system across every surface built by F001–F006: skeleton loading
states with no blank screens or layout jumps, busy-locked action buttons, friendly
recoverable error messages mapped from the six error classes with zero sensitive leaks,
contextual empty states with one-click next actions, self-dismissing stacking toasts,
optimistic task-completion/status-toggle with mandatory server-true rollback, light/dark
theme with device-local persistence and no wrong-theme flash, and a fully responsive shell
(desktop sidebar / tablet / compact mobile nav; modal on desktop, bottom sheet on mobile
for task create/edit). No new data entities, no new runtime libraries, no changes to the
five-step server contract — this feature changes how the app feels, not what it stores.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode mandatory, no `any`)

**Framework**: Next.js 15 App Router (React 19) — Server Components by default; Client
Components only where interactivity requires (theme toggle, toasts, optimistic toggle,
dialog/sheet)

**Primary Dependencies**: React 19 built-ins (`useOptimistic`, `useTransition`,
`Suspense`), Next.js route-level `loading.tsx`, Tailwind CSS + shadcn/ui primitives
(already the approved stack — CSS custom properties for theme tokens). **No new runtime
libraries** (constraint from spec; `next-themes` and a toast library evaluated and
rejected in `research.md` D3/D5).

**Storage**: PostgreSQL via Prisma — **unchanged by F007**; zero schema changes. Theme
preference is device-local (`localStorage`) and explicitly NOT account data (spec
Key Entities).

**Testing**: Vitest (unit), React Testing Library (component, incl. keyboard +
screen-reader behavior via aria snapshots), Playwright (E2E incl. slow-network throttling,
forced failures, theme reload, 3-device-class responsive runs).

**Target Platform**: Web — desktop, tablet, mobile browsers (responsive; no native app).

**Project Type**: Web application (Next.js full-stack, single project).

**Performance Goals**: Perceived-instant interactions — optimistic completion paints in
≤100ms (SC-003); skeleton→content swap with no cumulative layout shift; no-flash theme
restore on first paint.

**Constraints**: Spec Constraints section (user-mandated, Principle V verbatim):
optimistic only for completion/status-toggle with rollback; friendly errors with no
sensitive leaks + server-side diagnostics; modal/bottom-sheet + sidebar/compact nav;
a11y non-negotiable (incl. non-color status/priority); five-step contract unchanged;
security E2E remains a quality gate; FR-015 test gates.

**Scale/Scope**: 7 user stories × all F001–F006 surfaces (authentication, tasks,
categories, search/filters, dashboard). Cross-cutting refactor of presentation layer
only — one shared pattern set, applied surface by surface.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate applied to F007 | Pre-Design |
|---|-----------|----------------------|------------|
| 1 | I. Server-Authoritative Security | No client-supplied identity anywhere in new UX code; optimistic completion keeps its server action (validate→authenticate→authorize→execute→return) — the server result, not the client assumption, remains the truth; error messages carry zero server/db/password/session detail; diagnostics logged server-side only | PASS |
| 2 | II. Type Safety & Strict Validation | Strict TS throughout; Zod schemas remain the single source of truth (client validation stays a UX convenience); friendly-message mapping keys off existing typed result kinds, never free-form server text | PASS |
| 3 | III. Modular Architecture | Shared primitives in `src/components/ui/` + `src/lib/` (skeleton, toast, empty, error, busy, dialog/sheet, theme) reused by every surface; zero new runtime libraries (YAGNI — native React/Next/Tailwind capabilities suffice); server components + route `loading.tsx`/Suspense keep client JS minimal; no schema, action-contract, or index changes | PASS |
| 4 | IV. Test-First Quality Gates | FR-015 mandates unit (theme persistence, optimistic rollback), component (loading/empty/error/toast + keyboard + screen-reader), E2E (slow-network journey, forced failures + rollback, theme reload, responsive ×3 classes); existing security E2E (User A ≠ User B) stays green | PASS |
| 5 | V. UI States & UX Mandates | This feature **implements** Principle V directly: loading/error/empty/success handled on every surface; optimistic scope = completion/toggle only with rollback; friendly errors; responsive shell + modal/bottom-sheet; light/dark persisted; a11y incl. non-color status/priority | PASS |

**Verdict**: All 5 principles PASS pre-design. No violations → Complexity Tracking stays
empty. Post-design re-check after Phase 1 artifacts (below).

## Project Structure

### Documentation (this feature)

```text
specs/007-ux-polish/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   ├── ux-patterns.md   #   shared UX component contracts + error taxonomy mapping
│   └── server-actions.md#   result-kind surface F007 consumes (contract unchanged)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                    # MOD: ThemeProvider + ToastProvider; inline no-flash script
│   ├── error.tsx                     # NEW: app-level friendly boundary + retry
│   ├── not-found.tsx                 # NEW: friendly not-found (FR-003 class)
│   ├── (auth)/sign-in|sign-up/page.tsx  # MOD: busy-locked submit, field/form errors, retry, toasts
│   └── (app)/
│       ├── layout.tsx                # MOD: responsive shell — desktop sidebar / tablet / compact mobile nav
│       ├── tasks/
│       │   ├── loading.tsx           # NEW: route-level list skeleton
│       │   ├── page.tsx              # MOD: Suspense, first-task empty state, one-click clear, toasts
│       │   ├── new/page.tsx          # MOD: dialog (desktop) / bottom sheet (mobile) trigger
│       │   └── [id]/edit/page.tsx    # MOD: same dialog/sheet treatment
│       ├── categories/
│       │   ├── loading.tsx           # NEW
│       │   └── page.tsx              # MOD: create-category empty state, save/delete toasts
│       ├── dashboard/
│       │   ├── loading.tsx           # NEW: per-summary skeletons
│       │   └── page.tsx              # MOD: calm "all clear" summaries, recent-5 empty state
│       └── search|filtered views     # MOD: no-match empty state + one-click clearing
├── components/
│   ├── ui/
│   │   ├── skeleton.tsx              # NEW: pulse placeholder primitive, shapeable
│   │   ├── busy-button.tsx           # NEW: pending wrapper — disabled + labeled while in flight
│   │   ├── toast.tsx                 # NEW: viewport + stack (max ~3, auto-dismiss, aria-live)
│   │   ├── empty-state.tsx           # NEW: icon + title + description + one primary action
│   │   ├── error-message.tsx         # NEW: field-level + surface-level friendly presentation
│   │   └── dialog-or-sheet.tsx       # NEW: modal ≥768px / bottom sheet <768px, one a11y contract
│   ├── theme/
│   │   ├── theme-provider.tsx        # NEW: client context (light|dark|system), instant class swap
│   │   └── theme-toggle.tsx          # NEW: switchable from anywhere (shell + mobile nav)
│   ├── tasks/
│   │   ├── task-item.tsx             # MOD: optimistic completion/toggle (useOptimistic) + rollback
│   │   └── task-skeleton.tsx         # NEW: list-shaped rows (no layout jump)
│   ├── dashboard/dashboard-skeleton.tsx # NEW: summary cards + recent-list placeholders
│   └── layout/mobile-nav.tsx         # NEW: compact nav (<1024px), touch-sized controls
└── lib/
    ├── theme.ts                      # NEW: storage key, resolve(system|light|dark), inline script
    └── ux/
        ├── error-taxonomy.ts         # NEW: result-kind → {title, description, retryable}
        └── toast-messages.ts         # NEW: canonical copy for save/delete/complete ± failure
```

**Structure Decision**: Extends the F001–F006 single-project Next.js layout. New code is
confined to shared UX primitives (`components/ui/`, `components/theme/`, `lib/ux/`,
`lib/theme.ts`), route-level `loading.tsx`/`error.tsx`/`not-found.tsx`, and modifiers on
existing surfaces. No new server modules, no Prisma schema change, no route-handler
changes.

## Milestones

- **M1 — Foundations (US1 base)**: skeleton primitive + route `loading.tsx` for tasks,
  categories, dashboard; `busy-button` on every server-touching trigger. MVP gate: slow
  connection shows shaped placeholders immediately, no double submits anywhere.
- **M2 — Errors (US2)**: error taxonomy + `error-message` + app `error.tsx`/`not-found.tsx`;
  sign-in/sign-up and all forms show field-level friendly errors, preserve input, offer retry.
- **M3 — Empty states (US3)**: `empty-state` on first-account tasks, no-match search/filter
  (one-click clear), no categories, calm "all clear" dashboard summaries.
- **M4 — Toasts (US4)**: toast viewport (stack ≤3, auto-dismiss ~4s, manual dismiss,
  `aria-live="polite"`, no focus steal) wired to every background action.
- **M5 — Optimistic completion (US5)**: `useOptimistic` toggle on task items; rollback +
  error toast + exact server consistency on failure; unit-tested rollback behavior.
- **M6 — Responsive + Theme (US6/US7)**: shell sidebar/tablet/compact-nav; dialog vs
  bottom sheet; theme provider + toggle + no-flash script + persistence; both-theme
  contrast + non-color cues.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None — all five principles PASS pre- and post-design. Client Components introduced
(`theme-provider`, `toast`, `task-item` optimistic path, `dialog-or-sheet`, `mobile-nav`)
are the minimum interactivity surface required by Principle III's own exception clause
("Client Components only when interactivity requires them") and Principle V's mandates.

## Post-Design Constitution Re-Check

After Phase 1 artifacts: PASS (verified after writing research.md, data-model.md,
contracts/, quickstart.md — no schema changes, no new libraries, error copy leaks nothing,
five-step contract untouched, FR-015 test matrix fully enumerated in quickstart.md).


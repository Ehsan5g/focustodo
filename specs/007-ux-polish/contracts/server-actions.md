# Contract: Server Actions — surface consumed by F007 (UNCHANGED)

**Feature**: `007-ux-polish` | **Date**: 2026-09-18
**Verdict**: F007 modifies **zero** server action signatures, result kinds, validation
schemas, or the five-step contract. This document records the exact existing surface
the new UX layer consumes, so the presentation refactor cannot drift into contract
changes. Refer to `specs/003-task-management/contracts/server-actions.md` (actions),
`specs/005-search-filters/contracts/routes-and-surfaces.md` (filters), and
`specs/006-dashboard-statistics/contracts/server-actions.md` (dashboard) for full
definitions.

## Five-step contract (verbatim, unchanged)

Every touched action still: (1) validates input with Zod on the server → (2)
authenticates the user from the server session → (3) authorizes ownership → (4)
executes business logic → (5) returns a predictable typed result. Raw DB objects are
never returned; no client-supplied userId is ever trusted.

## Result kinds F007 maps to friendly copy (contracts/ux-patterns.md §UxError)

| Action (owner feature) | Success payload | Failure kinds F007 renders |
|------------------------|-----------------|----------------------------|
| register / signIn / signOut (F002) | session / redirect | validation_error (field), unauthenticated, server_error |
| createTask / updateTask / deleteTask (F003) | task DTO | validation_error, unauthenticated, forbidden, not_found, server_error |
| toggleTaskStatus (F003) | authoritative task DTO | forbidden, not_found, server_error (+ client network) — the optimistic path's rollback source |
| createCategory / updateCategory / deleteCategory (F004) | category DTO | validation_error (unique-name), unauthenticated, forbidden, not_found, server_error |
| search/filter param handling (F005) | filtered task list | client-only: invalid params fall back to defaults |
| getDashboardData (F006) | dashboard DTO | unauthenticated, server_error |

## Rules F007 adds on the client only

1. Optimistic UI wraps **only** `toggleTaskStatus` calls (status completion/toggle);
   the server action itself remains the single source of truth and still validates,
   authenticates, authorizes, and re-reads the row (Principle I holds under
   optimistic UI).
2. Failed action results are mapped through the UX error taxonomy; the taxonomy is
   presentation-only — no action may change its result shape to carry user copy
   (copy stays client-side, FR-014).
3. Technical diagnostics remain in existing server-side logs; nothing new is logged
   client-side, and no log content is rendered (FR-003, Principle V).
4. Retry = re-invoke the same action with the same original input (kept in component
   state); no input re-entry (FR-005).
5. New files in `lib/ux/` import action types only — they never call Prisma, never
   read sessions, and add no server modules.

## Security invariants carried forward (quality gates)

- User A can never read/modify User B's tasks or categories — the existing security
  E2E stays green after the UX refactor (spec Constraint).
- Password/session material never appears in client copy, toasts, or errors.
- Zod schemas remain shared client+server; client validation stays convenience-only.

# Quickstart: Validating Task Search & Filters (F005)

Runnable validation for the F005 acceptance criteria. Details: [data-model.md](data-model.md) (criteria, derivation rules, invariants), [contracts/server-actions.md](contracts/server-actions.md) (the `fetchTasks` read contract), [contracts/routes-and-surfaces.md](contracts/routes-and-surfaces.md) (routes, surfaces, interaction rules).

## Prerequisites

- F001 baseline + F002 auth + F003 task management + F004 categories working (register, sign-in, task CRUD, category management); Node 22, npm, Docker PostgreSQL; `.env` with `DATABASE_URL` + `AUTH_SECRET` (no new variables — D9).

## Setup

```bash
docker compose up -d
npm install
npx prisma migrate dev    # applies the existing F003/F004 migrations — F005 adds NONE (D9)
npm run dev
```

## Manual validation scenarios

| # | Scenario (FR) | Steps | Expected |
|---|---|---|---|
| S1 | Search matches title AND description, ignoring case (FR-001, US1 S1/S2) | Create tasks whose target word appears in a title only, a description only, and in both — some with different letter cases; search the word | Every task containing it in title or description appears regardless of case; non-matching tasks disappear |
| S2 | Search edge cases (FR-001, US1 S3, edge cases) | Search only spaces; search `100%_done 😊` (literal, matching nothing); clear the search | Spaces show ALL tasks; special characters match literally and never error; clearing restores the full list |
| S3 | Mid-typing inert (FR-001, edge case) | Type progressively in the search box without submitting | The list stays unchanged until Enter/submit — nothing narrows mid-typing |
| S4 | Status + priority filters (FR-002/FR-003, US2 S1–S4) | Create tasks across statuses and priorities; apply each status option, each priority option, then status + priority together | Each option shows exactly the matching tasks; the combination shows only tasks matching BOTH |
| S5 | Category filter (FR-004, US3 S1) | With categories "Work" and "Errands", filter by each; open the options as two different users | Only tasks in the selected category appear; each user's options list ONLY their own categories |
| S6 | Due-date presets (FR-005, US3 S2–S4, edge cases) | Create tasks due yesterday (one of them COMPLETED), today, in 3 days, next month, and one without a due date | Overdue shows only the past-due NOT-completed task; Due today only today's; Due this week includes today + within 7 days; No due date shows exactly the undated tasks; dated presets never include undated tasks |
| S7 | Sorting (FR-007, US4 S1–S3, edge cases) | Apply each of the five sorts over mixed tasks (same priority; same due date; no due date) | Newest/Oldest reverse each other; Due date earliest puts the soonest first and undated LAST; Priority high→low orders H/M/L; Title A→Z alphabetical; every tie resolves newest-first |
| S8 | Sort while narrowed (FR-007, US4 S4) | Apply a search narrowing the list, then change the sort | The narrowed set reorders without widening |

| S9 | Combination + count (FR-006/FR-008, US5 S1) | Tasks matching different combinations; search "report", filter category "Work" + status "To Do" | Only tasks meeting ALL THREE criteria appear; while any criterion is active, the count line shows the number of matches |
| S10 | No-match empty state (FR-009, US5 S2, edge case) | Apply criteria that match nothing | A clear "no tasks match" empty state with a reset action; no error; the user's tasks still exist after reset |
| S11 | Reset + reload defaults (FR-010, US5 S3, edge cases) | Set search + filters + sort; use "Reset filters"; then reload the page with criteria active | Reset clears the search, returns every filter to All and sort to Newest first, showing the full list; a reload returns everything to defaults |
| S12 | Freshness while filtered (FR-013, US5 S4, edge cases) | With a filter active: create a matching task; complete a matching task; delete a matching task; complete the overdue task | The created task appears; the completed/deleted one leaves the view; completing removes it from the Overdue preset |
| S13 | Stale category self-heal (edge case) | Filter by a category, then delete it (from `/categories` or another tab) | The category disappears from the options, the filter drops itself, and the remaining criteria apply — no error |
| S14 | Cross-user security (FR-011, SC-003, edge case) — *(automated)* | User A and User B create tasks with matching titles; A searches and filters with the same text/options | A's results contain ONLY A's tasks through every criterion combination |
| S15 | Scale + responsive + a11y (SC-006, FR-014, edge cases) | Seed 100+ tasks; keyboard-only walk of search/filter/sort/reset at desktop/tablet/mobile widths with color disabled | Fully responsive at 100+ tasks with no visual degradation; no horizontal scrolling at 320–1280 px; every control reachable by keyboard with visible focus and a clear label |

## Automated quality gates (all must pass)

```bash
npm run typecheck      # TypeScript strict — 0 errors
npm run lint           # ESLint — clean
npm run format:check   # Prettier — clean
npm run test           # Vitest unit + component (filter schema, query builder, service ownership, bar/container/empty state)
npm run test:e2e       # Playwright: S1–S15 journeys incl. combination, freshness (FR-013), cross-user security (SC-003), 100-task scale (SC-006)
```

## Expected end state

Every scenario passes; search, filters, count, and sorting reach the list only through the ownership-scoped five-step read (`fetchTasks`); a task is shown only when it matches every active criterion; the count line and the no-match empty state prevent dead ends; a category deleted while filtering self-heals; no user content or internals appear in any error or log; and no new migration, dependency, or environment variable was added (D9).


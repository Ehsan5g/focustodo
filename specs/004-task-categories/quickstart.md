# Quickstart: Validating Task Categories (F004)

Runnable validation for the F004 acceptance criteria. Details: [data-model.md](data-model.md) (entity, deletion/rename semantics, invariants), [contracts/server-actions.md](contracts/server-actions.md) (mutation contracts + assignment extension), [contracts/routes-and-surfaces.md](contracts/routes-and-surfaces.md) (routes, surfaces, read semantics).

## Prerequisites

- F001 baseline + F002 auth + F003 task management working (register, sign-in, task CRUD); Node 22, npm, Docker PostgreSQL; `.env` with `DATABASE_URL` + `AUTH_SECRET` (no new variables — research D11).

## Setup

```bash
docker compose up -d
npm install
npx prisma migrate dev    # applies the Category migration: categories table, Task.categoryId FK with SetNull, adopted indexes
npm run dev
```

## Manual validation scenarios

| # | Scenario (FR) | Steps | Expected |
|---|---|---|---|
| S1 | Create + visibility (FR-001, US1 S1, SC-001) | Sign in → `/categories` → create "Work" | "Work" appears in the alphabetical list and inside the task form's picker within ~2 s |
| S2 | Case-insensitive duplicate (FR-002, US1 S2) | Create "work" while "Work" exists | Inline error near the name field; no category created |
| S3 | Whitespace-only name (FR-001, US1 S3) | Submit only spaces | Inline "name is required" error; nothing created |
| S4 | Length boundary (FR-001, US1 S4) | Create a 60-character name; then a 61-character name | 60 accepted and displayed in full; 61 rejected with a clear message |
| S5 | Assign on create + edit (FR-006, US2 S1/S2) | Create a task picking "Work"; edit another task to "Errands" | Both tasks show the category name immediately after saving |
| S6 | Remove assignment (FR-006, US2 S3) | Edit a task and set the picker back to "No category" | Task shows no category; all other task details unchanged |
| S7 | Picker isolation + forged assignment (FR-004, US2 S4, SC-003) | Compare User A's and User B's pickers; *(automated)* submit A's categoryId as B | Each picker offers only its own owner's categories; the forged assignment is rejected before any change |

| S8 | Rename propagates (FR-009, US3 S1, SC-005) | Rename "Work" → "Deep Work" while 3 tasks carry it | The list, the picker, and all three task labels show "Deep Work" |
| S9 | Rename collision + boundary (FR-002, US3 S2/S3) | Rename a different category to "deep work"; rename another to 61 characters | Both rejected with clear messages near the name field; old names remain in place |
| S10 | Delete confirmation + cancel (FR-010, US4 S1/S3) | Delete a category holding 2 tasks; cancel once, then confirm | The confirmation states tasks become uncategorized but are not deleted; cancelling changes nothing |
| S11 | Delete outcome (FR-011, US4 S2, SC-004) | After the confirmed deletion | The category is gone from the list and picker; both tasks remain fully intact, now showing no category |
| S12 | Empty states (FR-012) | A fresh user opens the task form's picker and `/categories` | The picker shows a helpful empty state with a clear next action; tasks work fine without any category |
| S13 | Cross-tab staleness (edge cases) | Delete a category in another tab; reopen the picker; submit a stale assignment | List and picker reflect the deletion without a crash; the stale submit shows clear friendly feedback and changes nothing |
| S14 | Rename during edit (edge case) | Open a task edit form while renaming its category in another tab | Saving shows the current name — never an outdated label |
| S15 | Scale + responsive + a11y (SC-006, FR-013, FR-007) | Seed 50 categories + 100 tasks; keyboard-only walk of every surface at desktop/tablet/mobile widths with color disabled | List, picker, and task list fully usable with no horizontal scrolling at any viewport; every category readable as text, never color alone |

## Automated quality gates (all must pass)

```bash
npm run typecheck      # TypeScript strict — 0 errors
npm run lint           # ESLint — clean
npm run format:check   # Prettier — clean
npm run test           # Vitest unit + component (category schemas/boundaries, service authorization, assignment resolution, forms/picker/labels)
npm run test:e2e       # Playwright: S1–S15 journeys incl. cross-user security (SC-003), delete outcome (SC-004), rename propagation (SC-005), 50×100 scale (SC-006)
```

## Expected end state

Every scenario passes; categories are reachable and mutable only through ownership-scoped server actions; deleting a category nulls only task links while tasks keep all data (SC-004); renames are visible everywhere by reference (SC-005); duplicate names cannot exist regardless of letter case; no category name or internal detail appears in any error message or log.

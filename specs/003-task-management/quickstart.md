# Quickstart: Validating Task Management (F003)

Runnable validation for the F003 acceptance criteria. Details: [data-model.md](data-model.md) (entity + lifecycle matrix), [contracts/server-actions.md](contracts/server-actions.md) (mutation contracts), [contracts/routes-and-surfaces.md](contracts/routes-and-surfaces.md) (surfaces + read semantics).

## Prerequisites

- F001 baseline + F002 auth working (register, sign-in, protected area); Node 22, npm, Docker PostgreSQL; `.env` with `DATABASE_URL` + `AUTH_SECRET` (no new variables — research D13).

## Setup

```bash
docker compose up -d
npm install
npx prisma migrate dev    # applies the Task migration (first per-user business table)
npm run dev
```

## Manual validation scenarios

| # | Scenario (FR) | Steps | Expected |
|---|---|---|---|
| S1 | Create with only a title (FR-001, FR-002, SC-001) | Sign in → "New task" → enter only a title → save | Saved with status TODO, priority MEDIUM, no description/due date; appears in the list within ~2 s |
| S2 | Create with every field (FR-001) | Create a second task filling description, due date, priority, and an initial status | Every value saved and displayed exactly as entered |
| S3 | Invalid create (FR-003, edge cases) | Submit an empty or 121+-char title, a 1001+-char description, a malformed date | Field-level errors near each field; entered input preserved; nothing created |
| S4 | List privacy + non-color affordances (FR-004, FR-005, SC-003/007) | Create tasks as User A; sign in as User B and create one | B sees only B's task; every status and priority is readable with color disabled (text badges/labels) |
| S5 | Empty state (FR-013) | View the list of a fresh user | Helpful empty state with a clear create-first-task action |
| S6 | Complete, reopen, backward rejection (FR-008, clarified) | Complete a TODO task directly; reopen it (→ TODO); in the edit form pick a backward status (e.g., IN_PROGRESS → TODO) | Completing/reopening reflect immediately; the backward pick shows the inline `status` field error and the task is unchanged |

| S7 | Optimistic rollback (FR-009, SC-004) | *(automated)* E2E intercepts and aborts the toggle action mid-flight | The UI rolls back to the prior state, shows an understandable error, and matches the server afterwards |
| S8 | Edit incl. clearing + cancel (FR-006, FR-007) | Edit every field and save; edit again clearing description/due date and save; then cancel an edit | Changes persist across reload; cleared fields removed without side effects; the cancelled edit changes nothing |
| S9 | Delete confirm/cancel + stale delete (FR-010, FR-011) | Delete with confirmation; cancel a deletion; attempt to delete an already-deleted task from another tab | Confirm removes permanently; cancel leaves the task untouched; the stale attempt shows clear friendly feedback, no crash |
| S10 | Overdue flag (FR-012, clarified) | Create tasks due yesterday (uncompleted), today, and tomorrow; complete the yesterday task | Only the uncompleted past-day task is flagged overdue — by calendar day, no clock-time sensitivity; completed tasks are never overdue |
| S11 | Double-submit (US1 S4) | Rapidly double-click the create submit button | At most one task is created; the list stays consistent |
| S12 | UX/a11y + responsive + scale (FR-014, SC-005, SC-008) | Keyboard-only walk of create/edit/delete surfaces at desktop and mobile widths; view a seeded 100-task list | Focus visible, dialogs/sheet operable, no horizontal scroll at any viewport; the 100-task list stays fully usable |

## Automated quality gates (all must pass)

```bash
npm run typecheck      # TypeScript strict — 0 errors
npm run lint           # ESLint — clean
npm run format:check   # Prettier — clean
npm run test           # Vitest unit + component (schemas, transition matrix, overdue matrix, service authorization, forms/items/empty state)
npm run test:e2e       # Playwright: S1–S12 journeys incl. cross-user security, rollback interception, double-submit
```

## Expected end state

Every scenario passes; a user's tasks are reachable and mutable only through ownership-scoped server actions; the lifecycle and calendar-day rules behave exactly as clarified (forward-only transitions; overdue by calendar day); no task content or internals appear in any error or log.


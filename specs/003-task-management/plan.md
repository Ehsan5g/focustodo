# Implementation Plan: Task Management (F003)

**Branch**: `003-task-management` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-task-management/spec.md`

**Branch note**: The repository is not yet a git repository (F001 T001 pending), so `setup-plan.ps1 -Json` resolved the active feature as `002-user-auth`. This plan targets the explicitly requested feature directory `specs/003-task-management/`.

## Summary

Personal task CRUD inside the F002 protected area: one newest-first list of the signed-in user's tasks, a create/edit surface that adapts to the device (dialog on desktop, bottom sheet on mobile), single-interaction complete/reopen with optimistic updates and rollback, and confirmed permanent deletion. Tasks are the first per-user business data: a `Task` table owned by `User` (cascade delete), validated by one shared Zod schema (`src/validation/task-schema.ts`), and mutated exclusively through five-step server actions that derive identity from `requireSession()` and scope every query by `userId` — never trusting a client-supplied identifier. Two clarified semantics are first-class design inputs: the status lifecycle is forward-only (TODO → IN_PROGRESS → COMPLETED, completing directly from TODO included; reopen resets COMPLETED → TODO; backward moves are rejected with a field-level error via one shared pure transition rule), and due dates are calendar days (PostgreSQL `DATE`, no time-of-day; overdue derived at render by calendar day, never clock time). Vitest + React Testing Library + Playwright cover unit, component, and E2E layers — including the constitution-mandated cross-user security scenario. All open design decisions (D1–D13) are resolved in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict mode) on Node.js 22 LTS; npm (inherited from F001 research.md D1–D2)

**Primary Dependencies**: Next.js 16 (App Router), React 19, Zod, Prisma ORM, Tailwind CSS + shadcn/ui conventions — Dialog/Sheet/AlertDialog copy-in components are the only sanctioned addition (justified in research.md D7); no other new runtime dependencies

**Storage**: PostgreSQL 16 in the F001 Docker container; a Prisma migration adds the `Task` table (first per-user business model) with FK → `User` (`onDelete: Cascade`) and the evaluated compound index (research.md D11, D6)

**Testing**: Vitest (unit) + React Testing Library (component) + Playwright E2E on Chromium — CRUD journeys, lifecycle rejections, calendar-day overdue matrix, cross-user security, double-submit, stale-delete, optimistic rollback (research.md D12)

**Target Platform**: Local development (macOS/Windows/Linux); current stable Chrome/Firefox/Safari; responsive 320–1280 px (desktop/tablet/mobile per constitution V)

**Project Type**: Single full-stack Next.js application (extends the F001 skeleton + F002 auth in place)

**Performance Goals**: A created task appears in the list within 2 seconds of saving (SC-001); a 100-task list stays fully usable with no horizontal scrolling at any viewport (SC-005); F001 quality-gate budgets inherited unchanged (type check <1 min, suites <1 min, E2E <5 min)

**Constraints**: Every mutation is a five-step server action; shared Zod schemas are the single source of truth (constitution II); ownership enforced server-side on every read and mutation (FR-004, constitution I); forward-only status transitions with field-level rejection (clarified FR-008); calendar-day due dates and calendar-day overdue (clarified FR-001/FR-012); optimistic completion with guaranteed rollback (FR-009); permanent delete behind explicit confirmation (FR-010); newest-first list, no search/filter/sort (spec Assumptions); no new runtime libraries beyond the copy-in shadcn/ui components (D7)

**Scale/Scope**: 1 protected view (task list) + 3 interactive surfaces (adaptive create/edit surface, delete confirmation); 1 entity (`Task`); 5 user stories, 16 FRs, 11 edge cases, 8 success criteria

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Server-Authoritative Security (NON-NEGOTIABLE)**: PASS — identity in every action comes from `requireSession()` (F002); no action accepts a client-supplied `userId`; every Task query and mutation is scoped `where: { id, userId }` — ownership enforced at the server boundary (FR-004, constitution I); Zod re-validates all inputs server-side even though the client also validates (FR-003); results are mapped DTOs, never raw Prisma objects; cross-user attempts are indistinguishable from not-found (D9) — no existence leak.
- **II. Type Safety and Strict Validation**: PASS — one shared `src/validation/task-schema.ts` (create + update + task id), consumed by client forms and server actions alike, covering exactly the constitution's mandated shared schemas ("create task, update task"); TypeScript strict, no `any`; contractual limits encoded: title 1–120, description ≤1000, status `TODO|IN_PROGRESS|COMPLETED`, priority `LOW|MEDIUM|HIGH`; the forward-only rule is one shared pure function used by client and server (D2).
- **III. Modular Architecture and Simplicity**: PASS — F001/F002 separation preserved: `src/server/tasks/` (service: CRUD + `validateTransition` + `isOverdue`), `src/server/actions/task-actions.ts` (thin five-step actions), `src/validation/`, `src/features/tasks/` (components); the view stays in `(protected)`; Server Components by default, client components only where interactivity requires them; no new abstractions (no repository layer, no state library — React capabilities suffice, D3). One deliberate addition: shadcn/ui Dialog/Sheet/AlertDialog copy-in components — constitution-sanctioned conventions, justified once in D7, not a complexity violation.
- **IV. Test-First Quality Gates (NON-NEGOTIABLE)**: PASS — planned coverage: unit (task schemas incl. limits/defaults/enums, `validateTransition` full matrix, `isOverdue` calendar-day matrix, action authorization with mocked Prisma/`requireSession` where practical), component (TaskForm inline errors + defaults + clearing + cancel, TaskItem status/priority non-color affordances + overdue badge, empty state, delete confirm), E2E (create only-title/all-fields/invalid, edit incl. clearing + cancel, complete/reopen, backward-transition rejection, delete confirm/cancel, double-submit, stale-delete, list privacy, and the constitution-mandated cross-user security scenario: User A cannot access User B's tasks). Tests are written and observed failing before the code that satisfies them.
- **V. Production UX, Accessibility, and Performance**: PASS — dialogs/sheet are keyboard-operable with visible focus and labeled fields, inline errors near fields (FR-014, constitution V); status and priority carry text labels/badges, never color alone (FR-005, SC-007); completing/reopening is optimistic with rollback + an understandable error on failure (FR-009); loading/success/error and empty states all specified (FR-013); overdue visibly indicated (FR-012); modal on desktop / bottom sheet on mobile without horizontal scrolling (constitution V, FR-014).
- **Technology and Security Constraints**: PASS — server actions with the five-step contract on every mutation; Prisma confined to `src/server/`; queries select only UI-required fields (D4); indexes evaluated against actual patterns with deferred candidates documented (D6); the approved stack is unchanged (Next.js 16, React, TS strict, Tailwind, shadcn/ui conventions, Zod, Prisma, PostgreSQL); the only additions are copy-in shadcn/ui components justified in D7; no debug logging of user content.

**Pre-Phase-0 Verdict**: No unjustified violations — Phase 0 research may proceed.

**Post-Phase-1 Re-check**: PASS — after research.md (D1–D13), data-model.md, contracts/, quickstart.md: Principle I holds by construction — `userId` enters every predicate only from `requireSession()`, and ownership + freshness are protected together by the scoped `update`-load (`where: { id, userId }`) and `deleteMany` count pattern (D9/D10), so foreign, unknown, and already-deleted ids are indistinguishable friendly failures. Principle II holds: one schema file + one shared `validateTransition` function; strict TS untouched; defaults (`TODO`/`MEDIUM`) live in the shared Zod schema so client and server agree exactly. Principle III: the shadcn/ui copy-in components are the only added surface area and stay within sanctioned conventions; no Complexity Tracking rows. Principle IV: the coverage list is materialized in D12 and quickstart.md's automated gates. Principle V: the surface/a11y contract is pinned in contracts/routes-and-surfaces.md, and the optimistic rollback path is specified (D3). Technology constraints: zero new runtime dependencies beyond the copy-in Radix-backed shadcn components (D7); no new environment variables (D13).

## Project Structure

### Documentation (this feature)

```text
specs/003-task-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── server-actions.md
│   └── routes-and-surfaces.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

F003 extends the F001/F002 tree in place (no structural change); new and modified paths only:

```text
prisma/schema.prisma                    # EXTEND: add Task model + compound index (D11, D6)
prisma/migrations/                      # ADD: migration creating the tasks table
src/validation/task-schema.ts           # ADD: shared createTaskSchema/updateTaskSchema/taskIdSchema + enums (D2, D9)
src/server/tasks/                       # ADD: task service — CRUD, validateTransition, isOverdue (D1, D2, D10)
src/server/actions/task-actions.ts      # ADD: createTask / updateTask / setTaskStatus / deleteTask (five-step) (D9)
src/features/tasks/                     # ADD: TaskItem, TaskForm, adaptive create/edit Dialog+Sheet, DeleteConfirmDialog, empty state (D7)
src/app/(protected)/page.tsx            # EXTEND: F001/F002 placeholder shell becomes the task list view (D4)
tests/unit/ · tests/component/          # ADD: schema, transition matrix, overdue matrix, service authorization; component tests (D12)
tests/e2e/tasks.spec.ts                 # ADD: full task E2E journeys incl. cross-user security + rollback interception (D12)
```

**Structure Decision**: Single full-stack Next.js project, extending F001's tree with its shape unchanged (npm, `src/` + `tests/` at root, Prisma confined to `src/server/`, shared schemas in `src/validation/`). F003 adds one server module group (`src/server/tasks/`), one thin actions module, one shared schema file, and the tasks feature components; the F002 protected placeholder page becomes the real task list. No new routes — the feature is one protected view plus interactive surfaces over it.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | — | — |

No constitution violations: optimistic completion uses native React 19 primitives (no library), the lifecycle rule is one pure function shared client/server, and the shadcn/ui Dialog/Sheet/AlertDialog copy-in components are constitution-sanctioned conventions (D7) rather than added complexity.

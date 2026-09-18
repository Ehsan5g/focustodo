# Implementation Plan: Task Categories (F004)

**Branch**: `004-task-categories` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-task-categories/spec.md`

**Branch note**: The repository is not yet a git repository (F001 T001 pending). `setup-plan.ps1 -Json` was run with the sanctioned `SPECIFY_FEATURE` / `SPECIFY_FEATURE_DIRECTORY` override so the active feature resolves to `004-task-categories` (`.specify/feature.json` now points at `specs/004-task-categories`), and the script copied the plan template here.

## Summary

Categories inside the F003 task world: a signed-in user manages private, named categories from a new protected `/categories` page — create with a validated 1–60-character trimmed name, rename under the same rules, delete behind an explicit confirmation that states the consequence — and assigns at most one category to each task from a picker inside the existing adaptive task form, with "no category" remaining a first-class choice. Per-user case-insensitive uniqueness is enforced in the database: `Category` carries the entered `name` (trimmed, original case) plus a persisted, never-exposed `nameKey` (lowercased trimmed) under `@@unique([userId, nameKey])`, which also drives the case-insensitive alphabetical ordering (D1). Task's F003-reserved `categoryId` scalar becomes a real FK with `onDelete: SetNull`, so deleting a category nulls only the link while every assigned task keeps all of its data (D2). Assignment changes ride the existing five-step `createTask`/`updateTask` actions through the extended shared Zod schemas, and every submitted `categoryId` is resolved server-side against the caller's own categories — foreign, unknown, and just-deleted ids are one indistinguishable friendly field error (D3/D4). Category names ride the task query and renames propagate by reference with zero write-back, so list, picker, and every task label show the new name immediately (D5). Vitest + React Testing Library + Playwright cover schemas, service authorization, components, and E2E journeys — including the cross-user security scenario and the 50-category/100-task scale check (D10). All design decisions (D1–D11) are resolved in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict mode) on Node.js 22 LTS; npm (inherited from F001 research.md D1–D2)

**Primary Dependencies**: Next.js 16 (App Router), React 19, Zod, Prisma ORM, Tailwind CSS + shadcn/ui conventions — F004 adds **no new runtime dependencies**: it reuses F003's already-adopted copy-in Dialog/Sheet/AlertDialog components (research D7)

**Storage**: PostgreSQL 16 in the F001 Docker container; one Prisma migration adds the `Category` table and converts Task's reserved `categoryId` scalar into a real FK relation (`onDelete: SetNull`) with the adopted indexes (research D2, D6)

**Testing**: Vitest (unit) + React Testing Library (component) + Playwright E2E on Chromium — category schemas and boundaries, service authorization, picker/label components, full CRUD + assignment journeys, cross-user security, stale-category failure paths, 50×100 scale check (research D10)

**Target Platform**: Local development (macOS/Windows/Linux); current stable Chrome/Firefox/Safari; responsive 320–1280 px (desktop/tablet/mobile per constitution V)

**Project Type**: Single full-stack Next.js application (extends the F001 skeleton + F002 auth + F003 tasks in place)

**Performance Goals**: A created category appears in the category list and assignment picker within 2 seconds of saving (SC-001); assigning/changing a task's category shows the new name immediately after saving (SC-002); with 50 categories and 100 tasks the lists and picker stay fully usable with no horizontal scrolling on any viewport (SC-006); F001 quality-gate budgets inherited unchanged

**Constraints**: Every mutation is a five-step server action; shared Zod schemas are the single source of truth — including the task-assignment schema the constitution names explicitly (constitution II); ownership enforced server-side on every read and mutation (FR-004, constitution I); per-user case-insensitive uniqueness (FR-002, D1); delete = link nulling only, tasks never touched (FR-011, D2); rename propagates by reference (FR-009, D5); alphabetical case-insensitive ordering (FR-005, D1); no counters/colors/icons/reordering, no "uncategorized" pseudo-entry, permanent deletion, rename-to-same is a no-op (spec Assumptions); filtering/sorting tasks by category stays with the later filters feature; no new runtime libraries, no new environment variables (D7, D11)

**Scale/Scope**: 1 new protected route (`/categories`) + 3 interactive surfaces (adaptive category form, delete confirmation, picker integration in the existing task form); 1 new entity (`Category`) plus activation of Task's reserved link; 4 user stories, 15 FRs, 10 edge cases, 8 success criteria

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Server-Authoritative Security (NON-NEGOTIABLE)**: PASS — identity in every action comes from `requireSession()` (F002); no action accepts a client-supplied `userId`; every Category read/mutation is scoped `where: { id, userId }` (FR-004); assignment resolution looks the submitted `categoryId` up against the caller's own categories before any task write, so a foreign or forged id is rejected before any change happens (US2 S4, D4); results are mapped DTOs — `userId` and `nameKey` never cross to the client; foreign, unknown, and just-deleted ids are indistinguishable friendly failures (no existence leak, D4/D9); Zod re-validates all inputs server-side (FR-003).
- **II. Type Safety and Strict Validation**: PASS — one shared `src/validation/category-schema.ts` (create + update + id) and the extension of `src/validation/task-schema.ts` with the optional `categoryId` cover exactly the constitution's mandated shared schemas ("create category, update category", task assignment); TypeScript strict, no `any`; the contractual field (category names unique per user) is encoded as the D1 compound unique constraint, and the 1–60 length lives in the shared schema.
- **III. Modular Architecture and Simplicity**: PASS — F001–F003 separation preserved: `src/server/categories/` (service), `src/server/actions/category-actions.ts` (thin five-step actions), `src/validation/`, `src/features/categories/` (components), one new page under `(protected)`; Server Components by default, client interactivity only in the form/picker/confirm surfaces; **zero new dependencies and zero new abstractions** — the D1 `nameKey` column is a data-model necessity (DB-enforceable case-insensitive uniqueness), not an architectural layer; no Complexity Tracking rows.
- **IV. Test-First Quality Gates (NON-NEGOTIABLE)**: PASS — planned coverage (D10): unit (category schemas incl. 1–60 boundary/trim/case-insensitive collision, service authorization with mocked Prisma/`requireSession`, assignment resolution incl. stale/foreign ids, extended task schemas), component (CategoryForm inline errors, picker incl. empty state and unset choice, category list ordering, delete-confirm copy, task item name label), E2E (create/rename/delete incl. propagation, assign/change/remove, cross-user security scenario — User A cannot view, rename, delete, or assign User B's categories (SC-003), deletion outcome SC-004, rename propagation SC-005, scale SC-006, staleness edge cases). Tests are written and observed failing before the code that satisfies them.
- **V. Production UX, Accessibility, and Performance**: PASS — category forms reuse the adaptive Dialog/Sheet surfaces with keyboard operability, visible focus, labeled fields, and inline errors near the name field (FR-013, constitution V); the category is shown as a readable name, never color alone (FR-007); delete confirmation states exactly what will happen before anything is removed (FR-010); loading/success/error and both empty states (picker, page) are specified (FR-012); no horizontal scrolling at any viewport (FR-013, SC-006).
- **Technology and Security Constraints**: PASS — server actions with the five-step contract on every mutation; Prisma confined to `src/server/`; queries select only UI-required fields (D5); indexes evaluated against the two named patterns (Category.userId, Task.categoryId) with deferrals recorded (D6); the approved stack is unchanged; zero new runtime dependencies (D7); no new environment variables (D11); no logging of user content — diagnostics only, server-side.

**Pre-Phase-0 Verdict**: No unjustified violations — Phase 0 research may proceed.

**Post-Phase-1 Re-check**: PASS — after research.md (D1–D11), data-model.md, contracts/, quickstart.md: Principle I holds by construction — every category predicate includes `userId` from `requireSession()`, assignment authorization is an explicit server-side resolution step (D4), and the deletion path is the scoped `deleteMany` count pattern with `SetNull` doing the link-nulling declaratively (D2). Principle II holds: two shared schema files + one service boundary; strict TS untouched; the uniqueness contract lives in the database via `@@unique([userId, nameKey])` (D1). Principle III: no new dependencies, no new abstractions; the only additions are one service module group, one thin actions module, one schema file, one page, and feature components reusing F003's surfaces. Principle IV: D10 + quickstart.md's automated gates materialize the coverage. Principle V: the surface/a11y contract is pinned in contracts/routes-and-surfaces.md (FR-007/FR-010/FR-012/FR-013). Technology constraints: zero new runtime dependencies, zero new environment variables (D11).

## Project Structure

### Documentation (this feature)

```text
specs/004-task-categories/
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

F004 extends the F001/F002/F003 tree in place (no structural change); new and modified paths only:

```text
prisma/schema.prisma                    # EXTEND: add Category model; Task.categoryId reserved scalar → real FK relation, onDelete: SetNull (D2)
prisma/migrations/                      # ADD: migration creating the categories table + FK/index changes (D2, D6)
src/validation/category-schema.ts       # ADD: createCategorySchema / updateCategorySchema / categoryIdSchema (D1)
src/validation/task-schema.ts           # EXTEND: optional categoryId (string | null) on create/update task schemas (D3)
src/server/categories/                  # ADD: category service — list, create, update, delete (D3, D4, D5)
src/server/actions/category-actions.ts  # ADD: createCategory / updateCategory / deleteCategory (five-step) (D3)
src/server/tasks/                       # EXTEND: create/update resolve the submitted categoryId against owned categories (D4)
src/server/actions/task-actions.ts      # EXTEND: assignment validation inside createTask / updateTask (D3, D4)
src/features/categories/                # ADD: CategoryForm, category list/item, adaptive Dialog+Sheet reuse, delete confirmation, empty state (D7)
src/features/tasks/                     # EXTEND: TaskForm gains the category picker; TaskItem renders the category name (D5, D7)
src/app/(protected)/categories/page.tsx # ADD: category management page (D7)
src/app/(protected)/                    # EXTEND: navigation gains a Categories entry (sidebar / compact nav, D7)
tests/unit/ · tests/component/          # ADD/EXTEND: schemas, service authorization, forms/picker/labels (D10)
tests/e2e/categories.spec.ts            # ADD: full category + assignment E2E journeys incl. cross-user security (D10)
```

**Structure Decision**: Single full-stack Next.js project, extending the F001–F003 tree with its shape unchanged (npm, `src/` + `tests/` at root, Prisma confined to `src/server/`, shared schemas in `src/validation/`). F004 adds one server module group (`src/server/categories/`), one thin actions module, one shared schema file, one protected page (`/categories`), and the categories feature components — and wakes up Task's reserved `categoryId` as the real relation the constitution's data model always named. One new route; everything else extends existing files.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | — | — |

No constitution violations: the persisted `nameKey` column is the minimal DB-enforceable way to honor case-insensitive per-user uniqueness (a functional unique index would leave the Prisma schema); the `SetNull` FK replaces app-level fan-out logic; and every UI addition reuses F003's sanctioned Dialog/Sheet/AlertDialog components with zero new dependencies.

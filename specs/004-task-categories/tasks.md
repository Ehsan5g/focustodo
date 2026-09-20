---
description: "Task list for F004 Task Categories"
---

# Tasks: Task Categories (F004)

**Input**: Design documents from `/specs/004-task-categories/`

**Prerequisites**: plan.md âœ… (constitution check PASS pre- and post-Phase 1), spec.md âœ…, research.md âœ… (decisions D1â€“D11, zero open items), data-model.md âœ…, contracts/ âœ… (server-actions, routes-and-surfaces), quickstart.md âœ… (S1â€“S15)

**Tests**: Included â€” constitution IV mandates the unit/component/E2E gates, and FR-015 with SC-003/004/005/006/007 demand automated coverage; D10 pins the strategy: schema/boundary unit tests, service tests with a mocked Prisma client, component tests, Playwright journeys â€” cross-user and stale-action scenarios via request interception (F003's D12 pattern, never timing sleeps), and the SC-006 check against a seeded 50-category/100-task list.

**Organization**: Grouped by user story â€” US1 Create a Category (P1), US2 Assign a Task to a Category (P1), US3 Rename a Category (P2), US4 Delete a Category (P2). Action shapes per `contracts/server-actions.md`; page/read/surface semantics per `contracts/routes-and-surfaces.md`; the `Category` entity, `nameKey` mechanics, deletion/rename semantics, and the nine invariants per `data-model.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1â€“US4)

## Path Conventions

Single full-stack Next.js project extending F001+F002+F003 in place (plan.md): `src/` + `tests/` at repository root; Prisma confined to `src/server/`; shared Zod schemas in `src/validation/`; the scoped category service in `src/server/categories/service.ts`; actions in `src/server/actions/` (`category-actions.ts` is new; `task-actions.ts` is extended); feature UI in `src/features/categories/` (CategoryForm, list/item, adaptive Dialog+Sheet, delete confirmation, empty state) with the picker/label extensions in `src/features/tasks/`. F004 adds exactly ONE route â€” `/categories` at `src/app/(protected)/categories/page.tsx` â€” plus a Categories navigation entry; the task list stays at `/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch, the second per-user business data model, and its migration â€” no new dependencies, no env changes (D11).

- [X] T001 Confirm the F003 foundation is complete and all its quality gates are green (`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run test:e2e`), then create and switch to branch `004-task-categories` (if no git repo exists yet, first execute F001 T001 â€” `.gitignore` before any commit)
- [X] T002 [P] Extend `prisma/schema.prisma` exactly per data-model.md. ADD the `Category` model: `id String @id @default(cuid())`, `userId String` (FK â†’ `User.id`, `onDelete: Cascade`, never accepted from the client), `name String` (1â€“60 characters after trimming, original case preserved â€” the only displayed field), `nameKey String` (the lowercased trimmed name â€” persisted for per-user case-insensitive uniqueness AND alphabetical ordering, NEVER exposed to any client â€” D1), `createdAt`/`updatedAt`, relation `user User @relation(...)`, and `@@unique([userId, nameKey])` (D1; its `userId` leftmost prefix serves every per-user lookup â€” list, picker, ownership resolution â€” D6). ACTIVATE Task.categoryId (D2): F003's reserved scalar becomes the real optional relation `category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)` plus `@@index([categoryId])` (task-list name join D5 + the SetNull scan D6); leave F003's `@@index([userId, createdAt(sort: Desc)])` and the deferred status/priority/dueDate evaluation untouched
- [X] T003 Create and apply the migration `npx prisma migrate dev --name task_categories`; verify in the dev database: the `categories` table with all six columns, the composite `(userId, nameKey)` unique constraint, the Task FK with `ON DELETE SET NULL`, and the `Task.categoryId` index (D1, D2, D6; depends on T002)

**Checkpoint**: Branch `004-task-categories`; `categories` live with the composite unique; Task.categoryId is a real SetNull FK; zero new dependencies and zero new env vars (D11).

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared category validation and the ownership-scoped category service every user story builds on.

**âš ï¸ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Write the failing unit tests for the shared category schemas in `tests/unit/category-schema.test.ts` (D1, D9; data-model validation rules): `name` required and 1â€“60 characters after trimming â€” a 1-character name accepted, exactly 60 accepted, 61 rejected, whitespace-only rejected as empty (quickstart S3/S4); surrounding spaces trimmed before storage; `nameKey` is derived server-side at the service boundary â€” never accepted from the client and absent from every client-facing shape; `updateCategorySchema` re-uses the identical name rules; `categoryIdSchema` non-empty string
- [X] T005 [P] Write the failing unit tests for the category service with a mocked Prisma client in `tests/unit/category-service.test.ts` (D1, D4, D9, D10): every read/write is scoped `where { userId }`; the list selects ONLY UI fields ordered by `nameKey` ascending (alphabetical, case-insensitive â€” FR-005); create derives `nameKey` at the write boundary and maps the P2002 unique violation to the duplicate field error "You already have a category with this name." (D1); update treats an identical name after trim as a no-op success (D8); delete uses `deleteMany` + affected-count check â€” count 0 returns the SAME indistinguishable friendly failure for unknown id, another user's id, and just-deleted id (D4); mutations map to `CategoryDto` â€” no raw Prisma objects cross the boundary and no `userId`/`nameKey` field in the DTO (D9)
- [X] T006 Create `src/validation/category-schema.ts` making T004 pass: `createCategorySchema`, `updateCategorySchema`, `categoryIdSchema` â€” the single Zod source of truth shared by client and server (constitution II; D1) (depends on T004)
- [X] T007 Create `src/server/categories/service.ts` making T005 pass: `listCategories(userId)`, `createCategory(userId, input)`, `updateCategory(userId, id, input)`, `deleteCategory(userId, id)` â€” `nameKey` derived once at the write boundary; the database stays the uniqueness authority (D1, D4, D8, D9; depends on T006)
- [X] T008 Run the quality gates (`npm run typecheck && npm run lint && npm run format:check && npm run test`) and commit the foundational layer

**Checkpoint**: Category substrate ready â€” shared schemas and the scoped CRUD service all green; user story implementation can begin.

## Phase 3: User Story 1 â€” Create a Category (Priority: P1) ðŸŽ¯ MVP

**Goal**: A signed-in user creates a named category (1â€“60 characters) from an adaptive form; case-insensitive duplicates, whitespace-only, and over-length names are rejected with inline messages near the name field and nothing is saved; the new category appears immediately in the alphabetical list (US1 scenarios 1â€“4; the "appears in the picker" half of quickstart S1 lands with US2's picker, T021).

**Independent Test**: Create a category and verify it appears in the category list; submit "work" while "Work" exists (rejected near the field), submit only spaces (inline required error), submit 60 then 61 characters (accepted / rejected) (quickstart S1â€“S4, S12).

### Tests for User Story 1 (write FIRST, keep failing until the implementation lands)

- [X] T009 [P] [US1] Write the failing component tests for the create form in `tests/component/CategoryForm.test.tsx`: a spaces-only submit shows the inline "name is required" error near the field with zero calls (S3); a duplicate failure renders the message near the name field (S2); a 60-character name submits (S4); loading/success/error states visible; fully keyboard-operable with visible focus and a labeled field (FR-013, D7)
- [X] T010 [P] [US1] Write the failing component tests for the list in `tests/component/CategoryList.test.tsx`: renders categories alphabetically without regard to letter case (FR-005); the empty state shows a clear next action (FR-012, quickstart S12)
- [X] T011 [P] [US1] Write the failing E2E create scenarios in `tests/e2e/categories.spec.ts`, reached through the new "Categories" navigation entry (T014): create "Work" â†’ appears in the category list (S1, SC-001); "work" rejected near the field with no second row (S2); spaces-only â†’ inline error, nothing created (S3); 60 accepted / 61 rejected (S4); first visit shows the empty state with its next action (S12)

### Implementation for User Story 1

- [X] T012 [US1] Implement the `createCategory` server action in `src/server/actions/category-actions.ts` per contracts/server-actions.md â€” five steps in order: (1) validate via `createCategorySchema`; (2) `requireSession()`; (3) authorize â€” creating into one's own list is always allowed, the owner id never comes from the client; (4) execute â€” scoped `createCategory` with `nameKey` derived at the write boundary, P2002 â†’ the duplicate field error; (5) return `CategoryActionResult` + revalidate the category list (depends on T007)
- [X] T013 [P] [US1] Create the protected `/categories` page read at `src/app/(protected)/categories/page.tsx` (Server Component: session guard â†’ `listCategories(userId)` â†’ `CategoryDto[]`) and `src/features/categories/CategoryList.tsx` with the alphabetical list and the empty state, making T010 pass (FR-005, FR-012, D9; depends on T007)
- [X] T014 [US1] Create `src/features/categories/CategoryForm.tsx` (create mode; adaptive surface â€” Dialog on desktop, Sheet on mobile â€” reusing F003's copy-in components, D7) wired to `createCategory`, and add the "Categories" entry to the protected navigation, making T009 pass (depends on T009, T012)
- [X] T015 [US1] Validate US1 independently: T009â€“T011 green; quickstart S1â€“S4 + S12 manual pass; gates green; commit

**Checkpoint**: The building block exists â€” valid categories persist, appear alphabetically, and every rejection is inline, honest, and near the name field.

## Phase 4: User Story 2 â€” Assign a Task to a Category (Priority: P1)

**Goal**: When creating or editing a task the user picks one of their own categories â€” or explicitly none, "No category" being a first-class choice; the chosen name shows wherever the task appears; changes and removals give immediate feedback with rollback on failure; a forced cross-user assignment is rejected server-side before any change (US2 scenarios 1â€“4).

**Independent Test**: Create a category, assign it during task creation and via edit, verify the name shows on the task, then change and remove it; only the user's own categories are ever offered or accepted (quickstart S5â€“S7, S12, S13).

### Tests for User Story 2 (write FIRST)

- [X] T016 [P] [US2] Write the failing component tests for the picker in `tests/component/CategoryPicker.test.tsx`: lists only the user's own categories alphabetically (FR-004, FR-005); "No category" renders first as the default unset choice (FR-006, D7); selecting/removing round-trips `categoryId` (a string to assign, `null` to clear) into the submitted payload; with zero categories the picker shows a helpful empty state with a clear next action (FR-012, S12)
- [X] T017 [P] [US2] Write the failing E2E assignment scenarios in `tests/e2e/categories.spec.ts`: assign "Work" during creation â†’ the task shows "Work" (S5, US2.1); assign "Errands" via edit â†’ shows immediately after saving (S5, US2.2); set back to "No category" â†’ no category shown, every other detail unchanged (S6, US2.3); force-submit User A's `categoryId` as User B via request interception â†’ rejected with the `categoryId` field error and NO mutation reaches the database (S7, US2.4, SC-003 â€” F003's D12 pattern)
- [X] T018 [P] [US2] Extend the failing unit tests for assignment in `tests/unit/task-schema.test.ts` AND `tests/unit/task-service.test.ts`: `categoryId` optional on BOTH task schemas â€” non-empty string to assign, `null` to clear, default unset (D3); the service resolves a non-null `categoryId` via `category.findFirst({ where: { id, userId } })` BEFORE any task write â€” foreign, unknown, and just-deleted ids yield the SAME indistinguishable `categoryId` field error and leave the task unchanged (D4); `TaskDto` gains `categoryName: string | null` read by reference (D5)

### Implementation for User Story 2

- [X] T019 [US2] Extend `src/validation/task-schema.ts` (optional `categoryId`: string or `null`) and `src/server/tasks/service.ts` (scoped resolution before write; `categoryName` selected into `TaskDto` via the category join) making T018 pass (D3, D4, D5; depends on T018, T006)
- [X] T020 [P] [US2] Extend `createTask`/`updateTask` in `src/server/actions/task-actions.ts` per contracts/server-actions.md â€” the SAME five steps with the new authorize behavior: a non-null `categoryId` resolves against owned categories and a miss fails before any change; NO new action exists (D3, D4; depends on T019)
- [X] T021 [P] [US2] Create `src/features/categories/CategoryPicker.tsx` (select inside TaskForm with "No category" first) and the `TaskItem` category label in `src/features/tasks/` (readable name, never color alone â€” FR-007), and extend the task-list read in `src/app/(protected)/page.tsx` to select `categoryName` (D5), making T016 pass and completing quickstart S1's "appears in the picker" assertion (depends on T016, T019)
- [X] T022 [US2] Validate US2 independently: T016â€“T018 green; quickstart S5â€“S7 + S12 manual pass; gates green; commit

**Checkpoint**: The payoff lands â€” tasks carry exactly one of the user's own categories (or none), the name shows everywhere tasks appear, and cross-user assignment is dead on arrival.

## Phase 5: User Story 3 â€” Rename a Category (Priority: P2)

**Goal**: The user renames a category under the same rules as creation; the new name appears in the list, the picker, and on every assigned task; invalid names (case-insensitive duplicates, 61+ characters) are rejected with the old name left intact; renaming to the identical name is a harmless no-op success (US3 scenarios 1â€“3).

**Independent Test**: Rename a category that has assigned tasks and verify list, picker, and all task labels show the new name; attempt "deep work" while "Deep Work" exists (rejected near the field) and a 61-character name (rejected, old name remains) (quickstart S8â€“S9, S14).

### Tests for User Story 3 (write FIRST)

- [X] T023 [P] [US3] Write the failing E2E rename scenarios in `tests/e2e/categories.spec.ts`: rename "Work" (3 assigned tasks) to "Deep Work" â†’ list, picker, and all three task labels show the new name (S8, US3.1, SC-005); rename to "deep work" when "Deep Work" exists â†’ rejected near the name field (S9, US3.2); 61 characters â†’ rejected, old name remains (S9, US3.3); rename-to-identical succeeds as a no-op (D8); saving a task-edit form while its category was renamed in another tab shows the CURRENT name, never an outdated label (S14)
- [X] T024 [P] [US3] Write the failing component tests for the rename form in `tests/component/CategoryForm.test.tsx` (extend): opens pre-filled with the current name; inline duplicate and length errors render near the field (FR-013); keyboard-operable with visible focus

### Implementation for User Story 3

- [X] T025 [US3] Implement the `updateCategory` server action in `src/server/actions/category-actions.ts` per contracts/server-actions.md â€” five steps in order: (1) validate via `updateCategorySchema` + `categoryIdSchema`; (2) `requireSession()`; (3) authorize â€” load scoped `where: { id: categoryId, userId }`; a foreign or unknown id is indistinguishable (D4); (4) execute â€” identical name after trim â†’ no-op success (D8); else write `name` + `nameKey` once, P2002 against a *different* category â†’ the duplicate field error with the old name untouched; (5) return `CategoryActionResult` + revalidate `/categories` and `/` â€” labels propagate by reference, zero task writes (D5) (depends on T007)
- [X] T026 [US3] Wire rename into `src/features/categories/CategoryList.tsx` (a row control opening the pre-filled adaptive CategoryForm) making T024 pass (depends on T024, T025)
- [X] T027 [US3] Validate US3 independently: T023/T024 green; quickstart S8â€“S9 + S14 manual pass; gates green; commit

**Checkpoint**: Organization stays accurate â€” one rename refreshes every surface through reference, never by rewriting tasks.

## Phase 6: User Story 4 â€” Delete a Category (Priority: P2)

**Goal**: Deletion is deliberate: a confirmation states that assigned tasks become uncategorized but are NOT deleted; confirming removes only the category (the SetNull FK clears the links) and it disappears from list and picker while its tasks remain fully intact showing no category; cancelling changes nothing (US4 scenarios 1â€“3).

**Independent Test**: Delete a category that has tasks: the confirmation explains the effect, cancellation changes nothing, confirmation removes only the category, and every assigned task survives uncategorized (quickstart S10â€“S11, S13).

### Tests for User Story 4 (write FIRST)

- [X] T028 [P] [US4] Write the failing component tests for the confirmation in `tests/component/DeleteCategoryDialog.test.tsx`: the copy states assigned tasks become uncategorized and are not deleted (FR-010, US4.1); confirm invokes `deleteCategory`; cancel closes with zero mutations (US4.3); fully keyboard-operable with visible focus (FR-013, D7)
- [X] T029 [P] [US4] Write the failing E2E delete scenarios in `tests/e2e/categories.spec.ts`: confirm â†’ "Work" gone from list AND picker, its two tasks intact and showing no category (S11, US4.2, SC-004); cancel â†’ category and assignments unchanged (S10, US4.3); a stale second-tab delete â†’ friendly feedback, no crash, the list recovers after revalidation (S13 â€” F003's D12 pattern)

### Implementation for User Story 4

- [X] T030 [US4] Implement the `deleteCategory` server action in `src/server/actions/category-actions.ts` per contracts/server-actions.md â€” five steps in order: (1) validate via `categoryIdSchema`; (2) `requireSession()`; (3) authorize â€” ownership IS the deletion predicate: scoped `deleteMany({ where: { id, userId } })` (F003 D10 pattern); (4) execute â€” count 0 â†’ stop: foreign, already-deleted, and unknown ids are indistinguishable; otherwise the row is removed and `SetNull` nulls ONLY the task links â€” tasks keep every other field (D2, FR-011); (5) return `{ status: "success" }` Â· `failure("This category no longer exists. Refresh to see your current list.")` + revalidate `/categories` and `/` (depends on T007)
- [X] T031 [US4] Create `src/features/categories/DeleteCategoryDialog.tsx` (F003's copy-in AlertDialog, D7) and wire the delete control into CategoryList making T028 pass; rapid repeat clicks must not double-open the dialog or double-submit (F003's D8 pattern) (depends on T028, T030)
- [X] T032 [US4] Validate US4 independently: T028/T029 green; quickstart S10â€“S11 + S13 manual pass; gates green; commit

**Checkpoint**: Housekeeping is safe â€” deletion is confirmed, permanent, and provably never touches a task's data beyond nulling the link.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final compliance sweep and full-acceptance validation of the whole feature.

- [ ] T033 [P] Update `README.md`: refresh the data-model section for the `task_categories` migration, add a "Task Categories" subsection under key architectural decisions (persisted `nameKey` powering case-insensitive uniqueness AND alphabetical ordering â€” D1; `SetNull` FK so deletion touches only links â€” D2; assignment riding the extended task schemas with no new action â€” D3; server-side category resolution with indistinguishable failures â€” D4; propagation by reference via `categoryName` on TaskDto â€” D5; both spec-named indexes adopted â€” D6), and note that F004 added no new dependencies and no new env vars (D11)
- [ ] T034 Run the FR/SC acceptance sweep: execute the full quickstart.md S1â€“S15 manually (incl. S15 with a seeded 50-category/100-task list â€” list, picker, and task list usable with no horizontal scrolling at 320â€“1280 px, plus the keyboard-only walk with color disabled â€” SC-006, FR-013, FR-007); spot-check SC-001 (create visible â‰¤ 2 s) and SC-002 (assignment label immediate); run every automated gate (`npm run typecheck && npm run lint && npm run format:check && npm run test && npm run test:e2e`) confirming the FR-015/SC-007 coverage; confirm no raw Prisma objects cross the server/client boundary, no `userId` or `nameKey` appears in any DTO, and no user content or internals appear in any error or log (D4, D9; the nine data-model invariants); commit the completed feature on `004-task-categories`

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first (branch); T002 parallel; T003 depends on T002
- **Foundational (Phase 2)**: Depends on Setup â€” BLOCKS all user stories. Test-before-impl pairs: T004â†’T006, T005â†’T007 (T007 also consumes T006); T008 last (gates + commit)
- **US1 (Phase 3)**: Depends on Phase 2; T009âˆ¥T010âˆ¥T011 first (failing), then T012âˆ¥T013, then T014, then T015
- **US2 (Phase 4)**: Depends on US1 (the picker lives inside TaskForm; the label on TaskItem) and Phase 2; T016âˆ¥T017âˆ¥T018 first, then T019, then T020âˆ¥T021, then T022
- **US3 (Phase 5)**: Depends on US1 (the list page hosting rename); T023âˆ¥T024 first, then T025 â†’ T026 â†’ T027
- **US4 (Phase 6)**: Depends on US1 (the list page hosting delete); T028âˆ¥T029 first, then T030 â†’ T031 â†’ T032
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 â†’ US2 â†’ US3 â†’ US4** in spec priority order: US1 is the building block every other story reads; US2 completes the P1 value (the "appears in the picker" half of quickstart S1 lands at T021); US3's label propagation rides US2's task labels; US4's "gone from the picker" check rides it too
- **US3/US4 (P2)**: additive surfaces over the completed P1 slice; nothing in them reworks earlier stories â€” but they share `src/server/actions/category-actions.ts`, `src/features/categories/CategoryList.tsx`, and `tests/e2e/categories.spec.ts`, so implement them sequentially (a second developer can still pre-write each story's test-first files â€” no same-file conflicts among TEST tasks)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- The server action (five-step contract) before the client surface that calls it
- Core implementation before the story's independent validation task
- Story complete before moving to the next priority

### Parallel Opportunities

- Phase 1: T002 [P]; Phase 2: T004âˆ¥T005 (different test files)
- US1: T009âˆ¥T010âˆ¥T011 (independent test-first files), then T012âˆ¥T013 (action vs page read)
- US2: T016âˆ¥T017âˆ¥T018, then T020âˆ¥T021 (actions vs picker/label/page read)
- US3: T023âˆ¥T024; US4: T028âˆ¥T029; Polish: T033 [P]
- Cross-story parallelism is intentionally limited by the shared action/list/E2E files noted above; the next story's test-first files can still be written while the current story's implementation is reviewed

## Parallel Example: User Story 1

```bash
# Launch the three independent test-first files together (write first, keep failing):
Task: "Component tests for the create form in tests/component/CategoryForm.test.tsx"
Task: "Component tests for the list + empty state in tests/component/CategoryList.test.tsx"
Task: "E2E create scenarios in tests/e2e/categories.spec.ts"

# After the tests exist, action and page read split:
Task: "createCategory server action in src/server/actions/category-actions.ts (five steps)"
Task: "/categories page read + CategoryList + empty state in src/app/(protected)/categories/page.tsx and src/features/categories/"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup â†’ 2. Phase 2: Foundational â†’ 3. Phase 3: US1
4. **STOP and VALIDATE** (quickstart S1â€“S4 + S12) â€” the building block: a user manages their own alphabetical category list with honest inline errors
5. US2 is the same-P1 payoff that turns the block into organization â€” ship it before demoing the feature

### Incremental Delivery

1. Setup + Foundational â†’ the category substrate (shared schemas, scoped service)
2. US1 â†’ the building block (MVP)
3. US2 â†’ the payoff: tasks carry exactly one of the user's own categories
4. US3 â†’ renames propagate everywhere by reference
5. US4 â†’ confirmed, SetNull-safe deletion
6. Polish â†’ README, full S1â€“S15 acceptance, FR sweep

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The five-step server-action contract (contracts/server-actions.md) is spelled out in T012, T020, T025, and T030 â€” reviewers check the steps appear in order
- `userId` is never accepted from the client and never appears in any DTO; `nameKey` never leaves the server; no raw Prisma objects cross the server/client boundary (data-model invariants 1â€“2; D1, D4, D9)
- A non-null `categoryId` resolves against owned categories server-side BEFORE any task write â€” foreign, unknown, and just-deleted ids are one indistinguishable field error (D4); the picker only ever offers the user's own categories (D7)
- Deleting a category nulls only the link (`onDelete: SetNull`, D2 â€” data-model invariant 6); renames write `name` + `nameKey` once and propagate by reference with zero task writes (D5); rename-to-identical is a no-op success (D8)
- E2E cross-user and stale-action scenarios use request interception; the scale check uses a seeded 50Ã—100 list â€” never timing sleeps (D10; F003's D12/D8 patterns)
- Zero new dependencies, zero new env vars (D11)
- Commit after each task or logical group; stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence







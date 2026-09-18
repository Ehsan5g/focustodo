# Contract: Routes, Surfaces, and Read Semantics (F004)

## Route map (F004 adds one protected route)

| Route | Group | Access | Behavior |
|---|---|---|---|
| `/categories` | `(protected)` | signed-in only | **NEW**: category management — the user's categories alphabetically, with create/rename/delete |
| `/` | `(protected)` | signed-in only | F003 task list — items now also show the category name (read by reference, D5) |
| `/sign-in`, `/register` | `(auth)` | public | F002 auth views (untouched) |
| `/api/health` | — | public | F001 infrastructure probe (untouched) |

## Guards (inherited from F002 — unchanged)

1. `middleware.ts` (edge, advisory): coarse session-cookie/JWT check → redirect to `/sign-in?next=…`.
2. `(protected)` layout (authoritative): `requireSession()` — nothing protected renders before this passes.
3. `(auth)` layout (reverse guard): a valid session is bounced to the protected area.
4. **Rule 4 applies doubly for F004**: every category server action calls `requireSession()` itself.

## Read contract (server-only)

- Category projection — one shape for the management page **and** the picker: `category.findMany({ where: { userId }, orderBy: { nameKey: "asc" }, select: { id, name } })` — case-insensitive alphabetical (FR-005), only UI-required fields (D1, D5, constitution III).
- Task list read extends F003's `select` with `category: { select: { name: true } }`; rows map to `TaskDto` with `categoryName: string | null`. Renames need no re-fetch of tasks beyond the standard revalidate — the name is joined at read time.
- Pages render as Server Components; DTO mapping happens before anything crosses to a client component.

## Surfaces

| Surface | Where | Contract |
|---|---|---|
| Categories page | `/categories` body | alphabetical (case-insensitive) list; per-item rename and delete controls; "New category" control; helpful empty state with a clear create action (FR-012); protected navigation gains the Categories entry (sidebar desktop / compact mobile — constitution V) |
| Create category | page control → Dialog (desktop ≥sm) / Sheet (mobile <sm) | CategoryForm; labeled name field with inline errors near the field; success closes the surface and the list + picker reflect the category within ~2 s (SC-001) |
| Rename category | item control → same adaptive surface, prefilled | same naming rules; rename-to-same-name is a silent no-op success (D8); after save the new name shows on the list, in the picker, and on every assigned task (FR-009, SC-005) |
| Delete category | item control → AlertDialog confirmation | copy must state that assigned tasks become uncategorized but are **not** deleted (FR-010); cancel = untouched; confirm = permanent removal (no undo — spec Assumptions) |
| Assignment picker | inside `TaskForm` (create + edit) | labeled select; options = the user's own categories alphabetically; the unset state ("No category", the control's default) is the first-class unassigned choice — not a listed pseudo-entry (FR-006, spec Assumptions); empty state (no categories yet) with a clear next action to `/categories` (FR-012) |
| Task item label | task list items | shows the category name as readable text next to the task — never color alone (FR-007); very long names must not break the layout on small screens (spec edge case) |

## Form a11y & UX rules (FR-013, FR-007, constitution V)

- Every control keyboard-operable; visible focus; labeled fields; inline errors adjacent to their field; visible pending/success/error states on every async surface.
- Adaptive dialog/sheet and all lists render without horizontal scrolling at any supported viewport (320–1280 px).
- The category is conveyed by its name (and position in the picker), never by color alone.

Details: [server-actions.md](server-actions.md) for mutation contracts; [../data-model.md](../data-model.md) for the entity and semantics.

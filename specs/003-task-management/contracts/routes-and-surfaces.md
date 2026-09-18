# Contract: Routes, Surfaces, and Read Semantics

## Route map (unchanged from F002 — F003 adds no routes)

| Route | Group | Access | Behavior |
|---|---|---|---|
| `/` | `(protected)` | signed-in only | **becomes the task list view** (F001/F002 placeholder shell content replaced): the signed-in user's tasks, newest-first |
| `/sign-in`, `/register` | `(auth)` | public | F002 auth views (untouched) |
| `/api/health` | — | public | F001 infrastructure probe (untouched) |

## Guards (inherited from F002 — unchanged)

1. `middleware.ts` (edge, advisory): coarse session-cookie/JWT check → redirect to `/sign-in?next=…`.
2. `(protected)` layout (authoritative): `requireSession()` — JWT + DB `Session` row validation, sliding 30-day window. Nothing protected renders before this passes.
3. `(auth)` layout (reverse guard): a valid session is bounced to the protected area.
4. **Rule 4 applies doubly for F003**: every task server action calls `requireSession()` itself.

## Read contract (server-only)

- One query per list render: `task.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id, title, description, status, priority, dueDate, createdAt } })` — only UI-required fields (constitution III; research D4). `description` is included because the edit surface requires it.
- Overdue is computed in the render layer from `dueDate` + today's calendar day — never stored, never written (D1).
- The page renders as a Server Component; rows are mapped to `TaskDto` (see [server-actions.md](server-actions.md)) before crossing to any client component.

## Surfaces

| Surface | Where | Contract |
|---|---|---|
| Task list | protected page body | newest-first; each item shows title, status, priority (text badges/labels — never color alone, FR-005), due date when set, overdue flag when past its calendar day and not completed (FR-012); helpful empty state with a clear "create your first task" action (FR-013) |
| Create task | "New task" control → Dialog (desktop ≥sm) / bottom Sheet (mobile <sm) | TaskForm; defaults TODO / MEDIUM visible; success closes the surface and the task appears in the list (SC-001) |
| Edit task | item's edit control → same adaptive surface, prefilled | TaskForm with current values; cancel leaves the task untouched (US4 S4); a backward status choice shows the inline `status` field error before submit (D2) |
| Complete / Reopen | single item control | optimistic update with rollback + friendly error on failure (FR-009; D3) |
| Delete task | item's delete control → AlertDialog confirmation | explicit confirm required (FR-010); confirmed = permanent removal; cancel = untouched |

## Form a11y & UX rules (FR-014, constitution V)

- Every control keyboard-operable; visible focus; labeled fields; inline errors adjacent to their field; visible pending/success/error states.
- `<input type="date">` for the due date (date-only — no time-of-day exists in the model, D1).
- No horizontal scrolling at any supported viewport (320–1280 px).

Details: [server-actions.md](server-actions.md) for mutation contracts; [../data-model.md](../data-model.md) for the entity and lifecycle matrix.

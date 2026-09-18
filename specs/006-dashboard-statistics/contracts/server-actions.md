# Contract: Server Action — `fetchDashboardData` (F006)

Single read action for the entire dashboard, following the F002–F005 five-step contract. Mirrors the F005 `fetchTasks` action conventions (result envelopes, error kinds, `requireSession()` on every invocation).

## Signature

```ts
fetchDashboardData(input?: { timeZoneHint?: string }): Promise<DashboardData>
```

## Five steps

| Step | Contract |
|---|---|
| 1. Validate | Zod: `timeZoneHint` optional string; if present it must name a valid IANA zone (checked via `Intl.DateTimeFormat`) — invalid/absent ⇒ `{}`-equivalent hint, i.e. UTC fallback (research D1). No other input exists. Malformed input is normalized, never an error to the user |
| 2. Authenticate | `requireSession()` — resolve + validate the JWT, verify the DB `Session` row, extend the sliding window (F002). Unauthenticated ⇒ sign-in redirect per F002; the action never trusts a client-supplied userId (FR-005) |
| 3. Authorize | Implicit-by-scope: every query below filters `userId = session.user.id`; nothing else can widen it (the D1 hint cannot) |
| 4. Execute | `db.$transaction`-free sequential reads (D2): overdue `count`, due-today `count`, priority `groupBy` + open-total `count`, recent `findMany({ take: 5, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] })` — all scoped, all summary-field projections. Local-day windows derived from `now` + the validated hint (D1); UTC windows per F005 conventions |
| 5. Return | `DashboardData` DTO (research D4): serializable primitives/ISO-8601 strings + `generatedAt` = the action's `now`. Raw DB objects, Prisma types, and `Date` instances never cross to the client (Principle I) |

## Error behavior

- The action has no user-facing failure modes beyond authentication (the hint degrades silently; the reads are infallible by construction — D2's index-backed aggregates). Any unexpected DB error surfaces as F001's generic friendly-error path; sensitive details are logged server-side only (Principle V).
- There is no `validation_error` result kind: the only input normalizes rather than rejects (unlike `fetchTasks`, whose criteria can be malformed).

## Performance contract

- All queries are index-backed (`userId` leading; `status`/`priority`/`dueDate` filters per the F003 index pattern) with scalar or ≤5-row results — the SC-001/FR-012 <2 s budget holds at 100+ tasks behind the numbers.
- One action per dashboard view; summaries are mutually consistent (all computed from one `now`).

## Test hooks

- `now` is injected/clock-controlled in unit tests (D7); `generatedAt` in the DTO lets tests assert against the exact instant the server used (SC-002/SC-004).
- The pure computation lives in `lib/statistics.ts` (`computeStatistics`), unit-testable without Next.js/DB (D3).

Details: [../data-model.md](../data-model.md) for view definitions and the split-calendar boundary; [routes-and-surfaces.md](routes-and-surfaces.md) for how the page consumes this action.
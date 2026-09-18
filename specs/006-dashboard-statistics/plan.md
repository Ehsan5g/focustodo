# Implementation Plan: Dashboard Statistics (F006)

**Branch**: `006-dashboard-statistics` | **Spec**: [spec.md](spec.md) | **Input**: F006 — Recent tasks, Overdue, Due today, Priority distribution

**Note**: This template is filled in by the `/speckit-plan` command. The "Execution Flow" below describes the workflow stages; the filled sections follow it.

## Summary

A read-only, server-rendered dashboard at `/dashboard` for the signed-in user: an overdue count, a due-today count, a priority distribution (Low/Medium/High + open total), and the five most recently updated tasks — each with title, status, priority, and due date. All numbers are computed server-side over the user's own tasks (session identity, Principle I) via one five-step read action; non-zero summaries jump to the F005 task list pre-filtered via its existing presets (one-shot seed param, validated by the shared filter schema, stripped on mount); zero-count summaries are not clickable. The dashboard derives "today"/"overdue" from the user's perceived local calendar day (client-supplied, validated IANA timezone hint — research D1), while the task list keeps its F005 UTC windows; midnight-boundary disagreement is expected and tested (FR-007). Sign-in now lands on `/dashboard` (FR-014) and the primary navigation gains a Dashboard link. No new entities, no migrations, no new runtime dependencies.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Next.js 16 App Router + React (per the F005 plan's approved stack; constitution Technology Constraints are authoritative)
**Primary Dependencies**: Prisma ORM + PostgreSQL (existing `Task`, `User`, `Session`, `Category` models), Tailwind CSS + shadcn/ui conventions, Next Auth-compatible JWT session (F002), Zod (shared validation, Principle II)
**Testing**: Vitest + React Testing Library (unit/component), Playwright (end-to-end, incl. the User A/User B security scenario and midnight-boundary consistency tests)
**Target Platform**: Web (desktop/tablet/mobile 320–1280 px, light+dark themes)
**Project Type**: Web application (existing `src/` planned tree from F001–F005; this feature EXTENDS it — the repo is docs-only at planning time, so all paths use the ADD/EXTEND convention against the planned tree)

## Constitution Check (pre-design)

| Principle | Status | Notes |
|---|---|---|
| I. Security First | PASS | Session-derived identity only (FR-005); the read action runs `requireSession()` itself every invocation (F002 rule 4); all queries scoped `userId`; DTO-only returns — no raw DB objects cross to the client; the timezone hint is a presentation input, never an identity/authorization input (D1) |
| II. Input Validation | PASS | The action's only input (optional IANA timezone hint) is schema-validated; every jump's filter seed passes through the shared `taskFilterSchema` (FR-010); malformed values never reach a query |
| III. Layered Architecture | PASS | One small read action `fetchDashboardData` following the five-step contract; Server Components render; queries select only summary fields against the per-user index pattern (`userId`, `status`, `priority`, `dueDate`); no business logic in components; read-only (no mutations, no optimistic UI) |
| IV. Testing & Quality | PASS | FR-013 test matrix: unit (statistics + definitions + recency + midnight boundary), component (cards/list/empty states), E2E (reflection of task changes, jumps, User A/User B security) |
| V. Production UX/A11y/Perf | PASS | Semantic HTML, keyboard-operable summaries, status/priority never color-only; calm empty states with next actions (FR-004); responsive 320–1280 px, no horizontal scrolling, long titles truncate (SC-007/SC-008); <2 s with 100+ tasks (SC-001, FR-012) |

**Gate result**: No violations. No new runtime libraries, no migrations, no env changes.

## Project Structure

### Documentation (this feature)

```
specs/006-dashboard-statistics/
├── plan.md              # this file
├── research.md          # Phase 0 — decisions D1–D7
├── data-model.md        # Phase 1 — computed views, no new entities
├── quickstart.md        # Phase 1 — validation scenarios S1–S20
└── contracts/
    ├── server-actions.md          # fetchDashboardData five-step contract
    └── routes-and-surfaces.md     # /dashboard route, jump seeding, nav + redirect changes
```

### Source Code (EXTENDS the planned F001–F005 tree — repo is docs-only at planning time)

```
src/
├── app/
│   ├── (protected)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx                  # ADD — Server Component; requires session; reads ?seed (one-shot)
│   │   │   └── page.test.tsx             # ADD — component tests
│   │   ├── layout.tsx                    # EXTEND — primary navigation gains a Dashboard link
│   │   └── page.tsx                      # EXTEND — task list page accepts the one-shot ?seed param (D5)
│   └── (auth)/
│       └── sign-in/...                   # EXTEND — post-sign-in default destination becomes /dashboard (FR-014)
├── components/
│   └── dashboard/
│       ├── overdue-summary.tsx           # ADD — count card, clickable iff count > 0
│       ├── due-today-summary.tsx         # ADD — count card, clickable iff count > 0
│       ├── priority-distribution.tsx     # ADD — Low/Medium/High + open total
│       ├── recent-tasks.tsx              # ADD — up to 5 recent tasks + list link
│       └── empty-state.tsx               # ADD — calm empty state with next action (FR-004)
├── server/
│   └── actions/
│       └── dashboard.ts                  # ADD — fetchDashboardData (five-step read action)
└── lib/
    ├── statistics.ts                     # ADD — pure computation: overdue/due-today/priority/recent
    ├── statistics.test.ts                # ADD — unit tests incl. midnight boundary
    └── dashboard-dto.ts                  # ADD — DTO types (serializable, no raw DB objects)
```

**Key decisions carried into Phase 0** (researched in research.md):
- D1: local-day derivation (no per-user timezone stored) — client-supplied IANA hint, validated, server caches nothing
- D3: statistics computation — one Prisma round-trip set, pure `computeStatistics` module
- D5: jump mechanism vs. F005's no-URL rule — one-shot `?seed=` param, validated by `taskFilterSchema`, stripped on mount
- D6: `/dashboard` as the sign-in default destination (FR-014) — one-line change to F002's "absent `next`" rule

## Phase 0 — Outline & Research

Unknowns extracted from the Technical Context and the spec's routing decisions (the clarify session delegated three decisions to planning; all resolved in research.md):

1. Local-day derivation without a stored per-user timezone → **D1**
2. Statistics computation shape under the five-step contract → **D3**
3. Jump seeding vs. F005's "criteria never in the URL" rule → **D5**
4. Post-sign-in redirect change (FR-014) → **D6**
5. Query shape/index alignment for <2 s with 100+ tasks → **D2**
6. DTO surface and serialization rules → **D4**
7. Testing strategy for the midnight-boundary consistency requirement → **D7**

**Output**: `research.md` — all NEEDS CLARIFICATION resolved (no unknowns remain).

## Phase 1 — Design & Contracts

Prerequisites: research.md complete. Outputs:

- `data-model.md` — no new entities; four computed views over `Task` (overdue, due-today, priority distribution, recent five) with single definitions including the split-calendar boundary; serialization invariants
- `contracts/server-actions.md` — `fetchDashboardData(input?)` five-step read contract; DTO shape; result kinds
- `contracts/routes-and-surfaces.md` — `/dashboard` route map, nav + sign-in redirect changes, one-shot seed jump contract, surfaces & a11y rules
- `quickstart.md` — validation scenarios S1–S20 (counts, open-only, empty states, security, reflection, jumps, midnight boundary, landing, responsiveness)

## Constitution Check (post-design re-check)

| Principle | Status | Notes |
|---|---|---|
| I. Security First | PASS | `requireSession()` inside the action (F002 rule 4); every query scoped `userId`; identity never client-supplied; the timezone hint cannot widen or alter the query's user scope (D1); E2E User A/User B test (FR-013) |
| II. Input Validation | PASS | Zod-validated optional IANA hint; `?seed` decoded + revalidated through the shared `taskFilterSchema` before any query; malformed ⇒ defaults, never an error path to the user (D5) |
| III. Layered Architecture | PASS | One five-step read action; pure `computeStatistics` unit-testable without Next.js; Server Component rendering; summary-field-only selects on the per-user index pattern; no state stored |
| IV. Testing & Quality | PASS | Unit/component/E2E matrix per FR-013 including the explicitly-mandated midnight-boundary tests (SC-002) |
| V. Production UX/A11y/Perf | PASS | Empty states with next actions; keyboard + focus; no color-only meaning; 320–1280 px responsive; long-title truncation; single-action data fetch keeps the <2 s budget (SC-001) |

**Gate result (post-design)**: PASS — no violations, no constitution amendments required.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Timezone hint spoofed/garbled by the client | Treated as a presentation hint only — it cannot change the user scope or authorization (D1); invalid values fall back to UTC-derived presentation |
| F005's no-URL-criteria rule eroded by the jump | One-shot, validated, stripped-on-mount seed param is the ONLY sanctioned URL surface for criteria (D5); F005's reload-returns-defaults invariant is preserved |
| Midnight-boundary confusion ("dashboard says overdue, list says not") | By-design split calendars (clarification 1); the summary cards' link text explains the target view; boundary cases covered by automated tests (SC-002, D7) |
| Nav/redirect change regressing F002 flows | D6 touches only the default destination rule (absent `?next=`); explicit `?next` handling, open-redirect posture, and guard layers are untouched; covered by E2E S12–S13 |

## Milestones

| Milestone | Content |
|---|---|
| M1 | `fetchDashboardData` action + pure `computeStatistics` + unit tests (incl. midnight boundary) |
| M2 | Dashboard route + summary/priority/recent/empty-state components + component tests |
| M3 | Nav link + sign-in redirect (FR-014) + one-shot seed jumps (FR-008/FR-010) + E2E suite (incl. security scenario) |
| M4 | Quickstart scenarios pass (S1–S20); constitution gates re-verified |
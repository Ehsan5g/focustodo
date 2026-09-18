# Implementation Plan: Production Hardening (F009)

**Branch**: `009-production-hardening` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-production-hardening/spec.md`

## Summary

FocusTodo is functionally complete per specs 001–008; F009 hardens it for real-world use: a security review with a blocking login brute-force throttle, graceful error handling everywhere, strict performance budgets (≤500 ms list/filter/sort, ≤1 s dashboard/search/submit) measured on a defined 2-core/4 GB baseline, accessibility verified with real screen readers (NVDA on Windows plus one mobile screen reader), a one-command Docker deployment, and a professional README. The approach is review-driven (finding → failing test → fix), adds three small `src/lib` modules (fail-fast env validation, error catalog, in-memory rate limiter), config-level hardening (security headers, standalone build), a container/compose deployment contract, and review artifacts as explicit deliverables. No new runtime libraries and no new persistent entities.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) on Node.js 22 LTS

**Framework**: Next.js 16 (App Router), React 19 — approved stack per constitution

**Primary Dependencies**: Prisma ORM, Auth.js, Zod, Tailwind CSS, shadcn/ui conventions; testing via Vitest, React Testing Library, Playwright; tooling via ESLint, Prettier. No new runtime dependencies are introduced by this feature (`@axe-core/playwright` is added as a devDependency only).

**Storage**: PostgreSQL 16 (Docker Compose container — already the sanctioned local-dev mechanism; becomes the deployment database)

**Testing**: Vitest (unit), React Testing Library (component), Playwright (E2E + performance measurement + axe baseline)

**Target Platform**: Linux containers (Docker Desktop on Windows/macOS/Linux); browsers: current Chrome/Firefox/Edge/Safari desktop, iOS Safari / Android Chrome mobile

**Project Type**: Full-stack web application (single Next.js project — App Router co-locates UI and server code; no backend/frontend split)

**Performance Goals**: ≤500 ms task list, filtering, sorting; ≤1 s dashboard, search, form submissions — measured on the clarified baseline (2 CPU cores / 4 GB RAM, containers local) against a ~300-task reference dataset (FR-010, SC-004)

**Constraints**: no unnecessary libraries (constitution); single-instance deployment (spec assumption — makes the in-memory throttle valid); secrets never committed; five-step server-action contract; fail-fast environment validation; security headers on all responses

**Scale/Scope**: personal task manager, one authenticated user per account; 6 user stories, 18 functional requirements, 8 success criteria, 11 edge cases

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Constraint | Status | Evidence / Notes |
|---|---|---|
| I. Server-Authoritative Security | PASS | Throttling enforced server-side in the login action / Auth.js `authorize` step before credential verification; no client-supplied identity introduced; security headers and the secret audit are pure server concerns |
| II. Type Safety & Strict Validation | PASS | `src/lib/env.ts` validates the environment with Zod at module load (fail-fast); error catalog is a typed discriminated union; no `any`, no new type assertions |
| III. Modular Architecture & Simplicity | PASS | Three small, single-purpose lib modules + root config files; the in-memory limiter and native `next.config` headers avoid new libraries; `/api/health` Route Handler is justified under "Route Handlers only where appropriate" (container healthcheck) |
| IV. Test-First Quality Gates | PASS | Every hardening fix starts from a failing test: rate-limiter unit tests, error-boundary component tests, throttle E2E scenario, repeatable performance E2E measurements |
| V. Production UX, Accessibility & Performance | PASS | This feature operationalizes Principle V: budgets and the screen-reader matrix are pinned by clarify (Q1/Q3/Q4); review artifacts make the gate auditable |
| Technology & Security Constraints | PASS | Approved stack untouched; Docker Compose is the constitution-sanctioned infrastructure mechanism; single-instance scope documented as an Assumption in the spec |

**Verdict**: No violations — Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/009-production-hardening/
├── plan.md                # This file (/speckit-plan command output)
├── research.md            # Phase 0 output (/speckit-plan command)
├── data-model.md          # Phase 1 output (/speckit-plan command)
├── quickstart.md          # Phase 1 output (/speckit-plan command)
├── contracts/             # Phase 1 output (/speckit-plan command)
│   ├── environment.md     # Environment-variable contract
│   ├── error-responses.md # Error codes, user messages, logging contract
│   └── deployment.md      # Container/compose deployment contract
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── error.tsx                    # NEW — route-segment error boundary (US2)
│   ├── global-error.tsx             # NEW — root crash fallback (US2)
│   ├── not-found.tsx                # NEW — friendly 404 (US2)
│   ├── api/health/route.ts          # NEW — container healthcheck (US5)
│   └── …                            # existing pages from features 002–007
├── components/                      # existing UI + feature components (hardening fixes only)
├── lib/
│   ├── env.ts                       # NEW — Zod fail-fast env validation (US5)
│   ├── errors.ts                    # NEW — error catalog: code → user message (US2)
│   └── rate-limit.ts                # NEW — in-memory login throttle (US1)
└── server/
    ├── actions/                     # existing server actions — login wires in the throttle (US1)
    └── db/                          # existing Prisma client — imports env.ts (US5)

prisma/
├── schema.prisma                    # existing — index verification may add a migration (US3)
└── seed.ts                          # NEW — ~300-task reference dataset (US3)

tests/
├── unit/rate-limit.test.ts          # NEW — throttle logic (US1)
├── component/                       # NEW additions — error-boundary states (US2)
└── e2e/performance.spec.ts          # NEW — budget measurements (US3); throttle E2E extends US1

docs/reviews/                        # NEW — deliverable review artifacts
├── security-review.md               # US1 findings + resolutions
├── performance-review.md            # US3 measurements + index evidence
└── accessibility-review.md          # US4 NVDA + mobile SR findings

Dockerfile                           # NEW — multi-stage, non-root, standalone (US5)
docker-compose.yml                   # NEW — app + postgres, healthchecks (US5)
.dockerignore                        # NEW (US5)
.env.example                         # NEW — every env var documented (US5)
.gitignore                           # NEW/verify — must exclude .env*
next.config.ts                       # NEW/extended — standalone output + security headers (US1/US5)
README.md                            # NEW — constitution-mandated topics (US6)
```

**Structure Decision**: Single full-stack Next.js project (App Router co-locates UI and server code, so no backend/frontend split). F009 adds three small `src/lib` modules, root-level infrastructure files (Dockerfile, compose, env example), an `/api/health` Route Handler, App Router error boundaries, review artifacts under `docs/reviews/`, and the README — everything else is hardening changes inside the existing structure from features 001–008. Note: this workspace currently contains only Spec Kit artifacts (no implementation code yet — see research.md "Repository state"); the tree above is the concrete target the tasks phase realizes on the constitution's approved stack.

## Complexity Tracking

No constitution violations detected in the pre-design or post-design checks — nothing to justify.

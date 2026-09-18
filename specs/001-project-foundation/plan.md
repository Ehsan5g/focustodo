# Implementation Plan: Project Foundation & Tooling (F001)

**Branch**: `001-project-foundation` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-project-foundation/spec.md`

## Summary

Stand up the complete approved-stack foundation as a working, reproducible local environment: a Next.js 16 (App Router) + TypeScript-strict application with a themed, accessible, responsive placeholder shell; quality gates (type checking, linting, formatting, unit + component tests, E2E smoke) that pass on a clean checkout; a Prisma + PostgreSQL 16 data layer proven by a write-and-read health verification whose result survives restarts; fail-fast environment validation; and a README that takes a new developer from clone to running app in ≤15 minutes. The stack is fixed by the constitution; open implementation choices (package manager, tooling configuration, theme persistence, health-verification design, baseline schema policy) are resolved in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict mode) on Node.js 22 LTS; npm as package manager (research.md D1–D2)

**Primary Dependencies**: Next.js 16 (App Router, React), Tailwind CSS + shadcn/ui conventions, Prisma ORM, Zod; ESLint + Prettier tooling; no runtime libraries beyond the approved stack (research.md D3–D5)

**Storage**: PostgreSQL 16 in a disposable local Docker container (Docker Compose, named volume); migration-managed, intentionally empty schema (research.md D8)

**Testing**: Vitest (unit) + React Testing Library (component) + Playwright E2E smoke on Chromium (research.md D6–D7)

**Target Platform**: Local development (macOS/Windows/Linux); current stable Chrome/Firefox/Safari

**Project Type**: Single full-stack Next.js application (App Router co-locates UI and server code)

**Performance Goals**: Quality-gate budgets only (SC-002): type check <1 min, lint <1 min, unit+component suites <1 min, E2E smoke <5 min steady state; documented setup ≤15 min (SC-001)

**Constraints**: Approved stack fixed by constitution (FR-002); no unnecessary runtime libraries; real secrets never committed; no CI, hosting, or production configuration; no business schema and no seed data (spec Assumptions)

**Scale/Scope**: One placeholder page + application shell; empty migration-managed database; 4 user stories, 15 FRs, 5 edge cases, 7 success criteria

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Server-Authoritative Security (NON-NEGOTIABLE)**: PASS — no business data or mutations exist yet; the server-authoritative posture is structural: Prisma access confined to `src/server`, Zod selected as the shared validation stack (`src/validation`), fail-fast environment validation (FR-012), no committed secrets. Auth.js and session-based ownership arrive with the authentication feature; nothing here can bypass a server boundary because none handles business input.
- **II. Type Safety and Strict Validation**: PASS — strict mode from day one (FR-003) with lint rules banning `any`; Zod installed and a sample shared-schema unit test (FR-005) proves the single-source-of-truth pattern every future input contract must use.
- **III. Modular Architecture and Simplicity**: PASS — the directory layout IS the constitution's mandated separation (UI primitives, feature components, server module, validation schemas, shared lib); Prisma client is a singleton; Server Components are the shell default; the schema is empty, so the index policy (constitution III) is trivially satisfied and is documented as a per-feature obligation in [data-model.md](data-model.md).
- **IV. Test-First Quality Gates (NON-NEGOTIABLE)**: PASS — this feature's deliverable IS the harness: unit, component, and E2E smoke infrastructure with at least one passing sample per layer (FR-005/FR-006), green on the untouched scaffold (FR-014) and inside the SC-002 budgets. Business-flow and security E2E scenarios arrive with their features.
- **V. Production UX, Accessibility, and Performance**: PASS — the shell ships semantic HTML, keyboard operability, visible focus (FR-011), responsive correctness at 320/768/1280 px (FR-015), and light/dark/system-default theming with persistence (FR-010); status/priority color rules are N/A (no tasks exist); error UX is demonstrated via the health verification's remediation-oriented failure output.
- **Technology and Security Constraints**: PASS — the stack is exactly the approved list (FR-002); PostgreSQL runs via Docker Compose for local development; theming uses a native implementation with zero additional runtime dependencies (research.md D4), honoring "no unnecessary libraries"; no passwords or auth data exist in this feature.

**Verdict**: No violations — Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-foundation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

F001 creates the entire repository tree — the workspace currently contains only Spec Kit artifacts:

```text
package.json / package-lock.json      # npm manifest + lockfile (D1)
.nvmrc / .editorconfig / .gitignore   # Node 22 pin (D2), editor norms, secret/ignore hygiene (FR-012)
next.config.ts / tsconfig.json        # Next 16 config; TypeScript strict (FR-003)
eslint.config.mjs / .prettierrc.json  # lint + format gates (FR-004, D5)
vitest.config.ts / tests/setup.ts     # unit + component harness (FR-005, D6)
playwright.config.ts                  # E2E smoke (FR-006, D7)
docker-compose.yml                    # PostgreSQL 16 service only (D9)
.env.example                          # documented env contract (FR-012, D10)
README.md                             # FR-013 / SC-003 command-by-command guide
prisma/schema.prisma                  # datasource + generator only; NO models (D8)
prisma/migrations/                    # migration history (starts empty)
src/app/                              # layout.tsx, page.tsx (placeholder), globals.css
src/app/api/health/route.ts           # write-read health verification (D11)
src/components/ui/                    # shadcn-style primitives (FR-011)
src/components/theme/                 # native ThemeProvider + toggle (D4)
src/features/                         # empty home for future feature components/actions
src/server/db.ts                      # Prisma client singleton
src/lib/env.ts / src/lib/utils.ts     # fail-fast env validation (D10); cn() helper
src/validation/                       # shared Zod schemas home + sample schema
tests/unit/ tests/component/ tests/e2e/  # >=1 sample test per layer (FR-005/FR-006)
```

**Structure Decision**: Single full-stack Next.js project (App Router co-locates UI and server code, so no backend/frontend split). F001 delivers the repository skeleton the constitution's modular separation requires; later features add business modules inside it without structural change. Repo bootstrap (git init, initial commit on `001-project-foundation`, `.gitignore` in place before any commit) is itself a task of this feature, since no git repository exists yet.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

(No violations — table intentionally left empty.)
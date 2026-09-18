# FocusTodo

A focused todo application. This repository currently contains the verified
**project foundation** (feature `001-project-foundation`): tooling, database
baseline, design system, and app shell — ready for future task features.

## Product

FocusTodo helps you keep a focused, fast todo list. The foundation feature
delivers no task features itself; it proves every quality gate and the app
shell end-to-end.

## Features

- **001-project-foundation (implemented)** — Next.js 16 + React 19 + Tailwind 4
  app shell, strict TypeScript, ESLint/Prettier gates, Vitest unit tests,
  Playwright E2E harness, disposable PostgreSQL 16 via Docker Compose,
  migration-based Prisma 7 schema baseline, health endpoint, light/dark/system
  theme system with no wrong-theme flash.

## Tech stack

- Next.js 16.3.5 (App Router, Turbopack), React 19.2.8, TypeScript 5 (strict)
- Tailwind CSS 4 (PostCSS plugin, CSS-variable design tokens)
- Prisma 7.10.0 + `@prisma/adapter-pg` (PostgreSQL 16 via Docker Compose)
- Zod 4 (environment + shared input schemas), class-variance-authority,
  clsx, tailwind-merge (`cn()` helper)
- Vitest 4 (unit), Playwright (E2E, Chromium), ESLint 9 flat config
  (`eslint-config-next`), Prettier 3 (+ tailwindcss plugin)

## Architecture

- **App Router pages** render via server components; the theme toggle is the
  only client component (minimal client JS).
- **`src/lib/env.ts`** — single Zod-validated environment module; the process
  exits with ONE actionable message on invalid configuration (fail fast).
- **`src/server/db.ts`** — the only file importing Prisma; dev singleton on
  `globalThis` survives hot reload.
- **`prisma/schema.prisma`** — intentionally empty baseline; schema changes are
  migration-based (`db:migrate` / `db:deploy`), never `db push`.
- **Design system** — `src/components/ui/*` primitives (shadcn/ui conventions)
  over CSS-variable tokens in `src/app/globals.css` (light values on `:root`,
  dark on `.dark`).

## Project structure

```
prisma/            schema.prisma (empty baseline), seed.ts, migrations/
src/app/           App Router: layout.tsx, page.tsx, api/health/route.ts
src/components/    ui/ primitives, theme/ (provider + toggle)
src/lib/           env.ts (validated env), utils.ts (cn)
src/server/        db.ts (Prisma singleton — only Prisma import site)
src/validation/    shared Zod schemas (single source of truth)
tests/             unit/ (Vitest), e2e/ (Playwright)
.specify/          Spec Kit artifacts (constitution, specs)
```

## Prerequisites

- Node.js 22 (see `.nvmrc`; `package.json` enforces `>=22`)
- Docker Desktop running (for the disposable database)

## Environment variables

Copy `.env.example` to `.env` — every listed variable is real and validated at
startup by `src/lib/env.ts`:

| Variable       | Required | Example                                                   |
| -------------- | -------- | --------------------------------------------------------- |
| `DATABASE_URL` | yes      | `postgresql://postgres:postgres@localhost:5432/focustodo` |

Invalid configuration exits with one actionable message naming every problem.

## Local development

```bash
cp .env.example .env
npm install
npm run db:up        # disposable PostgreSQL 16 on localhost:5432
npm run dev          # http://localhost:3000
```

## Database setup

Schema management is **migration-based** (data-model.md D8):

```bash
npm run db:up        # start the disposable db
npm run db:migrate   # prisma migrate dev — create/apply local migrations
npm run db:deploy    # prisma migrate deploy — apply without edits (fresh clone)
```

The baseline ships with **zero migrations** (empty schema). `docker compose
down -v` + `db:up` + `db:deploy` recreates the database from zero with no
manual steps.

## Quality gates

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run format:check # prettier --check .
npm run format       # prettier --write .
npm run test         # vitest run (unit)
npm run test:e2e     # playwright test (requires `npx playwright install chromium` once)
npm run build        # production build (also runs type checking)
```

All gates run locally before every commit. `npm test` executes the unit
(node) and component (jsdom) Vitest projects.

## E2E tests

Playwright runs against a local dev server (`npm run dev` must be running, or
the Playwright webServer starts it):

```bash
npx playwright install chromium   # one-time browser download
npm run test:e2e
```

## AI-assisted workflow

This project is developed with [Spec Kit](https://github.com/github/spec-kit):

- Constitution: `.specify/memory/constitution.md`
- Specs: `specs/<feature-id>/` (`spec.md`, `plan.md`, `tasks.md`, `contracts/`)
- `/speckit.plan` → `/speckit.tasks` → `/speckit.implement` lifecycle; every
  feature branches as `<feature-id>-<slug>`.

## Key architectural decisions

- **Migration-based schema management** — `db push` is not used; history is
  reviewable and reproducible from zero (D8).
- **Fail-fast environment validation** — one message, exit 1, no stack traces
  (FR-012).
- **Prisma confined to `src/server/`** — no Prisma imports anywhere else
  (constitution III).
- **Native theming** — CSS variables + `localStorage["focustodo-theme"]` +
  pre-hydration inline script; no theme library (D4).
- **Minimal client JS** — the theme toggle is the only client component
  (FR-015).

## Troubleshooting

- **Port 3000 in use** — kill the other process or start on another port:
  `npm run dev -- --port 3001`.
- **Port 5432 in use** — another Postgres is bound to the host port; stop it or
  change the host mapping in `docker-compose.yml` (and `.env`).
- **Database unreachable** — start it and verify:
  `docker compose start db`, then check `curl http://localhost:3000/api/health`
  (503 responses include the same remediation hint).
- **First E2E run** — Chromium is not downloaded by default; run
  `npx playwright install chromium` once.

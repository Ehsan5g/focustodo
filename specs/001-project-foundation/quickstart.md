# Quickstart: Project Foundation & Tooling (F001)

Validation guide proving the foundation works end-to-end. Implementation commands live in [contracts/commands.md](contracts/commands.md) (the README must match them verbatim); design rationale in [research.md](research.md); data structures in [data-model.md](data-model.md); shell contract in [contracts/ui-shell.md](contracts/ui-shell.md).

## Prerequisites

- Node.js 22 LTS (`node -v`), Docker Desktop running, npm 10+.

## Setup (fresh clone; SC-001 target: ≤15 minutes)

1. `npm install`
2. `docker compose up -d db` (script `db:up`)
3. `cp .env.example .env`
4. `npm run db:migrate`
5. `npm run dev` → open http://localhost:3000

## Validation scenarios

**V1 — Fresh-clone reproducibility (US1 / SC-001)**: wipe `node_modules`, the Docker volume (`docker compose down -v`), and `.env`; follow the README top-to-bottom only; the app runs with a live database in ≤15 minutes with zero undocumented steps.

**V2 — Quality gates (US2 / SC-002 / FR-014)**: on the untouched scaffold, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (≥1 unit + ≥1 component sample, all passing), and `npm run test:e2e` (after the one-time `npx playwright install chromium`) all pass within budgets. Then inject a type error, a lint violation, and a broken assertion → each gate fails and names the location; revert → green again.

**V3 — Data layer round trip + persistence (US3 / SC-005 / FR-007–009)**: `curl http://localhost:3000/api/health` → 200 `{"status":"ok",...}` with attempts=1; call again → attempts=2; a plain app+db restart preserves the counter (real persistence, not in-memory); after `docker compose down -v`, `db:deploy` + restart + health call recreates the scratch table cleanly from zero.

**V4 — Theme persistence (US4 / SC-004 / FR-010)**: toggle dark → UI updates immediately; fully quit and reopen the browser → still dark; clear site data → back to the system default on the next visit.

**V5 — Responsive, accessible shell (US4 / SC-006 / FR-015)**: placeholder page at 320 / 768 / 1280 px → correct layout, no horizontal scrolling; keyboard-only tab → visible focus, all interactive elements reachable.

**V6 — Fail-fast environment (FR-012 / US1 scenario 3)**: remove `DATABASE_URL` from `.env`, restart → startup fails with a message naming the variable; restore → boots normally.

**V7 — Database unreachable (edge case)**: `docker compose stop db`, run `npm run db:migrate` or hit `/api/health` → clear "database unreachable" message with the remediation hint (start the db), no raw internal error; `docker compose start db` → recovers.

**V8 — README command audit (SC-003 / FR-013)**: execute every README command verbatim (they match contracts/commands.md); each works as written; the troubleshooting section covers port-in-use, unreachable db, and the first E2E install.

## Troubleshooting

- Port 3000/5432 busy → stop the conflicting service (README remedy).
- `db` unhealthy → confirm Docker Desktop is running; `docker compose logs db`.
- E2E reports a missing browser → `npx playwright install chromium` (one-time).
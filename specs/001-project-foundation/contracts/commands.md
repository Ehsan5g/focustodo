# Contract: Documented Commands (F001)

The README's commands are F001's primary external interface (SC-003: 100% work verbatim; SC-001: full setup ≤15 min). Each row is a contract item: exact spelling, purpose, success outcome, and failure behavior. README and this file MUST stay in sync.

| Command | Purpose | On success | On failure |
|---|---|---|---|
| `npm install` | install dependencies from the lockfile | node_modules ready | actionable error; check Node 22 (`node -v`) |
| `docker compose up -d db` (script `db:up`) | start the disposable PostgreSQL 16 | container healthy (pg_isready) | hint to start Docker Desktop |
| `npm run db:migrate` | bring a brand-new/empty DB to the current schema (FR-008) | migration history initialized, zero errors | "database unreachable" message with a remediation hint (start the db) |
| `npm run db:deploy` | scripted recreate from zero (`prisma migrate deploy`) | same as above, non-interactive | same remediation |
| `npm run dev` | start the app (Turbopack) | http://localhost:3000 serves the shell | actionable startup error naming the problem (missing env, port in use → remedy in README) |
| `npm run build` | production build proof | build completes | type errors surface here too |
| `npm run typecheck` | TypeScript strict gate (FR-003) | zero errors, <1 min | failing file/line reported |
| `npm run lint` | ESLint gate (FR-004) | zero errors, <1 min | rule + file/line reported |
| `npm run format:check` | Prettier conformance gate | conformance confirmed | offending files listed (`npm run format` fixes) |
| `npm test` | unit + component suites (FR-005) | all pass, <1 min | failing test named with location |
| `npm run test:e2e` | Playwright smoke vs the running app (FR-006) | smoke passes, <5 min steady state | browser missing → run the install command below |
| `npx playwright install chromium` | ONE-TIME browser runtime install (edge case) | Chromium cached | documented in the README before the first E2E run |
| `curl http://localhost:3000/api/health` | health verification (FR-009) | `{"status":"ok",...}` with HTTP 200 | 503 + remediation hint, no internals |

## Rules

- Every README command must match this table exactly (single source of truth; the review executes each verbatim — SC-003).
- Defect-injection check (US2 scenario 6): a type error fails `typecheck`, a lint violation fails `lint`, a broken assertion fails `test` — each reports the failing location.
- Port conflict: startup failure must be understandable, with the remedy documented in the README (spec edge case).
# Quickstart: Production Hardening (F009)

Validation guide — proves the hardening works end-to-end. Implementation commands (`npm run …` scripts) are defined in `tasks.md`; this file records what "done" looks like. See [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), and [contracts/](contracts/) for details.

## Prerequisites

- Docker Desktop (running), Node.js 22 LTS, npm 10+; ~10 GB disk for images.

## Setup (two paths)

### A. One-command containers (deployment path — US5 / SC-007)

1. `cp .env.example .env` → set `AUTH_SECRET` (`openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`); the compose default `DATABASE_URL` works.
2. `docker compose up --build`
3. **Expected outcome**: db healthy → migrations applied → app healthy; http://localhost:3000 serves the app; `curl -f http://localhost:3000/api/health` returns `{"status":"ok"}`; the cold start (first `up` including image pulls) completes in under 15 minutes on ordinary hardware; `docker compose ps` shows both services healthy; the app container runs as a non-root user.

### B. Local development (existing workflow)

1. `cp .env.example .env` (point `DATABASE_URL` at localhost; `AUTH_SECRET` as above).
2. `docker compose up -d db` → `npm install` → `npx prisma migrate dev` → (`npx prisma db seed` for the performance dataset) → `npm run dev`.
3. **Expected outcome**: dev server on :3000; any env-validation problem stops startup with a readable message naming each issue.

## Validation scenarios

**V1 — Fail-fast environment**: rename `AUTH_SECRET` in `.env`, restart the app → startup fails listing the missing variable (contracts/environment.md); restore it → boots normally.

**V2 — Security review passes**: run the checks in `docs/reviews/security-review.md` — credential-pattern grep returns 0 hits, `.gitignore` covers `.env*`, `npm audit --omit=dev` reports no high/critical issues, and `curl -sI http://localhost:3000` shows X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and a CSP header. No open blocker/major findings.

**V3 — Throttle blocks brute force**: 5 consecutive wrong passwords for one email → the 6th attempt returns "Too many sign-in attempts. Please try again later." (contracts/error-responses.md); after the window expires (or a successful reset in tests) sign-in works again. Automated: throttle unit tests + E2E scenario pass.

**V4 — Graceful failure**: `docker compose stop db` → navigate or search → friendly "Something went wrong…" with no stack trace or SQL in the UI, while server logs carry code + stack; `docker compose start db` → recovers without an app restart.

**V5 — Boundaries**: visit a nonexistent URL → friendly not-found page with a way back; a dev-flag-triggered render error shows the `error.tsx` fallback whose "Try again" recovers.

**V6 — Performance budgets (SC-004)**: with the seeded ~300-task dataset on the production build, run the performance E2E on the 2-core/4 GB baseline → all measured interactions within ≤500 ms (list/filter/sort) and ≤1 s (dashboard/search/submit); results appended to `docs/reviews/performance-review.md`; `EXPLAIN ANALYZE` shows index usage on the hot list query.

**V7 — Accessibility**: keyboard-only pass over registration → login → create → edit → complete → filter → logout with visible focus and no traps; NVDA (Windows, Chrome + Firefox) announces content/states/errors on key pages; one mobile screen reader (VoiceOver iOS or TalkBack) passes the mobile journeys; status/priority never rely on color alone; the axe baseline reports no critical violations. Record in `docs/reviews/accessibility-review.md`.

**V8 — README & gates**: README covers all constitution-mandated topics (list in research.md §12); a newcomer following Local Development reaches a running app; `npm run lint`, `npm run typecheck`, and the full test suites are green.

## Troubleshooting

- Port 3000/5432 busy → stop the conflicting service or override ports in compose.
- `AUTH_SECRET` rejected → must be ≥32 characters (contracts/environment.md).
- Health returns 503 → db not healthy yet; check `docker compose logs db`, then the app logs.
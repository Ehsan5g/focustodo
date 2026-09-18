# Contract: Container Deployment (F009)

Defines the images, services, and startup sequence that make `docker compose up --build` a working app (research.md §6–7).

## Dockerfile (multi-stage, non-root, standalone)

| Stage | Base | Purpose | Output |
|---|---|---|---|
| deps | node:22-alpine | install all dependencies | node_modules |
| build | node:22-alpine | `next build` with `output: 'standalone'` (+ `prisma generate`) | .next/standalone, .next/static, migrations |
| runner | node:22-alpine | run as non-root `nextjs` user, `NODE_ENV=production`, HEALTHCHECK | `node server.js` on port 3000 |

- The entrypoint runs `npx prisma migrate deploy` before starting the server (idempotent).
- `.dockerignore` excludes node_modules, .next, .git, `.env*`, specs, docs.

## docker-compose.yml services

| Service | Image/Build | Ports | Key config | Healthcheck |
|---|---|---|---|---|
| db | postgres:16-alpine | 5432 (host-exposed for local dev) | POSTGRES_USER/PASSWORD/DB from env, named volume `pgdata` | `pg_isready -U …` |
| app | build: . (Dockerfile) | 3000:3000 | env via `.env` (`env_file`), DATABASE_URL pointing at `db:5432`, `depends_on: db: condition: service_healthy` | HTTP GET `/api/health` (interval, timeout, retries, start_period) |

- `restart: unless-stopped` on both services.
- Environment contract: see contracts/environment.md; inside the compose network the database host is `db`.

## One-command flows

- **First run / cold machine**: `docker compose up --build` → migrations applied → app healthy on http://localhost:3000 (SC-007 budget: under 15 minutes including image pulls on ordinary hardware).
- **Code update**: `docker compose up --build -d` → verify `/api/health`.
- **Teardown with data reset**: `docker compose down -v`.

## Guarantees

- App container: non-root, production build (no dev server), no source mounted, healthcheck enforced.
- Database data survives `docker compose restart` / `down` (named volume) — only `down -v` destroys it.
- `/api/health` semantics per contracts/error-responses.md HTTP mapping (503 when the database is unreachable).
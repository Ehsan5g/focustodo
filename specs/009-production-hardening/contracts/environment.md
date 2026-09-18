# Contract: Environment Variables (F009)

The process environment is F009's primary external interface. Validation is centralized in `src/lib/env.ts` (Zod, fail-fast at module load — research.md §4).

## Variables

| Variable | Required | Example | Validation | Description |
|---|---|---|---|---|
| DATABASE_URL | yes | postgresql://focus:…@db:5432/focustodo | URL format | Prisma/PostgreSQL connection string |
| AUTH_SECRET | yes | output of `openssl rand -base64 32` | min length 32 | Auth.js signing/encryption secret |
| NODE_ENV | no | production | enum | Set by the framework/runtime; `production` in containers |

- `.env.example` MUST list every variable (required and optional) with safe placeholders and inline comments; it MUST stay in sync with `src/lib/env.ts` (checked in the security review).
- Secrets live only in `.env` (git-ignored) or the orchestrator's secret store; `.env` MUST never be committed (working-tree audit + `.gitignore` verification; re-run after repo init).

## Fail-fast behavior

On missing/invalid variables the process exits at startup with one error naming every problem, e.g.:

```text
Invalid environment configuration:
- DATABASE_URL: required
- AUTH_SECRET: string must contain at least 32 character(s)
```

Nothing initializes first — no database client, no auth, no server; there is no partial boot.

## Consumers

- `src/server/db` (Prisma client) and the Auth.js configuration import `env.ts`; the Docker `app` container receives variables via compose `env_file`/`environment` (see contracts/deployment.md).
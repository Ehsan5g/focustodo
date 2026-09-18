# Contract: Environment Variables (F001)

Environment validation is centralized in `src/lib/env.ts` (Zod, fail-fast at module load — research.md D10).

## Variables

| Variable | Required | Example | Validation | Description |
|---|---|---|---|---|
| DATABASE_URL | yes | postgresql://postgres:postgres@localhost:5432/focustodo | URL format | Prisma connection string for the local disposable PostgreSQL |
| NODE_ENV | no | development | enum development\|production\|test | Set by the framework/runtime |

- `.env.example` documents every variable F001 uses with safe placeholder values; `.env` (real values) is git-ignored and never committed (FR-012).
- Fail-fast: on missing/invalid variables the app exits at startup with one message naming each problem, e.g. `Invalid environment configuration: - DATABASE_URL: required` — never an internal stack trace (US1 scenario 3).

## Extension convention (later features)

Each feature that needs new configuration MUST extend `src/lib/env.ts` (schema + validation) and update `.env.example` in the same change. Known upcoming additions: `AUTH_SECRET` (authentication feature; F009 requires ≥32 chars), any future feature flags. This keeps `.env.example` honest: every listed variable is real and validated.
# Data Model: Production Hardening (F009)

**Feature**: `specs/009-production-hardening` | **Date**: 2026-09-16

## Scope

F009 introduces **no new persistent entities** and modifies no existing contracts. It adds (a) an index plan over existing tables, (b) ephemeral in-process state for throttling, (c) a validated configuration object, and (d) document artifacts for the three reviews.

## Existing entities (unchanged — constitution contracts)

| Entity | Fields | Key constraints |
|---|---|---|
| User | id, name, email, passwordHash, createdAt, updatedAt | email unique; passwordHash never exposed to the client or logged |
| Task | id, userId, title, description?, status, priority, dueDate?, categoryId?, createdAt, updatedAt | title 1–120; description ≤1000; status TODO\|IN_PROGRESS\|COMPLETED; priority LOW\|MEDIUM\|HIGH; ownership via userId |
| Category | id, userId, name, createdAt, updatedAt | name unique per user |

Field validation remains shared Zod schemas (constitution II); F009 changes none of them.

## Index plan (existing tables, delivered as a migration)

| Query pattern | Index | Purpose |
|---|---|---|
| List tasks for user | `Task(userId)` | base ownership filter |
| Default list sort | `Task(userId, dueDate)` | avoid filesort on the hot path |
| Filter by status / priority / category | `Task(userId, status)`, `Task(userId, priority)`, `Task(userId, categoryId)` | selective filters |
| Category list per user | `Category(userId)` | sidebar/dashboard queries |

The final minimal set is confirmed via `EXPLAIN ANALYZE` during the performance review (research.md §9) before the budget run.

## New ephemeral state: rate-limit bucket (NOT persisted)

```text
RateLimitBucket {
  key: string          // `${email}|${ip}`
  failures: number     // failed attempts in the current window
  windowStart: number  // epoch ms when the window opened
}
```

- **Storage**: in-process `Map` inside `src/lib/rate-limit.ts`; constants MAX_FAILURES = 5, WINDOW_MS = 900000 (15 min).
- **Lifecycle**: absent → counting (failures 1–4) → throttled (5th failure; further attempts rejected with AUTH_RATE_LIMITED) → expired (window passes; bucket evicted) **or** reset (successful login).
- **Not persisted by design**: single-instance deployment is a spec assumption; a restart clears buckets — recorded as an accepted limitation in the security review.
- **Privacy**: buckets hold only the attempted email/IP pair already present at sign-in; bucket contents are never logged.

## New validated configuration: EnvConfig

```text
EnvConfig (Zod-inferred) {
  DATABASE_URL: string (URL format)              // required — Prisma connection string
  AUTH_SECRET:  string (min length 32)           // required — Auth.js signing secret
  NODE_ENV:     "development" | "production" | "test"
}
```

Loaded once at module import of `src/lib/env.ts`; invalid or missing values stop startup with one error naming every problem (contracts/environment.md).

## Validation rules added by F009

- Environment: the EnvConfig schema above is the only new input contract; `.env.example` must stay in sync (checked in the security review).
- Throttle configuration is code constants, not user input — no runtime configuration surface.

## Review artifacts (documents, not runtime data)

`docs/reviews/{security,performance,accessibility}-review.md` each record findings as: `id, severity (blocker|major|minor), finding, evidence, resolution, verified-by`. A review passes when no blocker/major findings remain open — blockers are fix-before-release per clarify Q2.
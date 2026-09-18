# Data Model: Project Foundation & Tooling (F001)

**Feature**: `specs/001-project-foundation` | **Date**: 2026-09-16

## Scope

F001 creates no business entities (explicit spec scope). It delivers the schema substrate, one client-side preference, and one runtime scratch structure for the health verification.

## Database Baseline (schema substrate)

- **State**: `prisma/schema.prisma` = datasource + generator only, ZERO models; migration history starts empty (research.md D8).
- **Schema management**: `npm run db:migrate` (prisma migrate dev) is the single documented command that takes a brand-new empty database to the current schema with zero manual steps (FR-008); `npm run db:deploy` (prisma migrate deploy) covers scripted recreate. Only `_prisma_migrations` exists after initialization.
- **Lifecycle**: disposable by design — `docker compose down -v` destroys it and the documented commands recreate it identically (US3 scenario 4, edge case "db deleted and recreated").
- **Index policy (constitution III)**: no tables → nothing to index. Every future feature MUST evaluate indexes against its actual query patterns when it introduces tables; F001 records the obligation, not the indexes.

## Theme Preference (client-side, NOT in the database)

| Field | Value |
|---|---|
| Storage | `localStorage` key `focustodo-theme` |
| Values | `light` \| `dark` \| `system` |
| Default | `system` (resolved via `prefers-color-scheme`) when no stored value |
| Transitions | first visit → system; user toggle → choice applied + persisted; browser restart → stored choice restored (SC-004) |
| Application | `<html>` class strategy set pre-hydration by an inline script (no flash of wrong theme) |

The only end-user-facing data in F001 (spec Key Entities); it never touches PostgreSQL and survives a full browser restart via localStorage.

## HealthCheck scratch structure (runtime-created, NOT in migrations)

| Field | Type | Notes |
|---|---|---|
| id | integer PK | fixed singleton = 1 |
| checked_at | timestamptz | last verification time |
| attempts | integer | monotonically increasing per verification call |

- **Lifecycle**: absent → created on first `/api/health` call (`CREATE TABLE IF NOT EXISTS`) → upsert id=1 (increment attempts, set checked_at) → read back and returned. Rows persist in the Postgres volume, so post-restart calls observe the previous attempts value — the SC-005 persistence proof.
- **Why not in the schema**: the baseline must contain no tables beyond what schema management requires (spec); a runtime-created scratch table keeps migrations clean while still proving the data layer.
- **Safety**: the table name is a compile-time constant; no user input is interpolated; all values are bound as parameters (constitution I).

## Validation rules introduced by F001

- Environment: `DATABASE_URL` required, URL format; `NODE_ENV` enum (contracts/environment.md). No business input schemas yet — `src/validation/` ships with a sample schema + unit test proving the shared-schema pattern (constitution II) that every future feature must follow.
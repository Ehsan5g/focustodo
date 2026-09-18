# Data Model: User Authentication & Authorization (F002)

**Feature**: `002-user-auth` | **Date**: 2026-09-16
**Sources of truth**: [spec.md](spec.md) (FR-001–FR-015 + clarifications), [research.md](research.md) (D2, D3, D4, D11)

## Entities

### User

| Field | Type | Constraints / Rules | Origin |
|---|---|---|---|
| `id` | `String` (cuid, PK) | generated, immutable | constitution data model |
| `name` | `String` | 1–80 chars, trimmed (Zod) | FR-001 |
| `email` | `String` | ≤254 chars, **trimmed + lowercased at input** (`normalizeEmail`), RFC-lite pattern, **unique** (DB constraint) | FR-001, clarification #2 (input limits #4) |
| `passwordHash` | `String` | scrypt-encoded `scrypt$N$r$p$<salt>$<hash>`; **never selected into any client payload** | FR-002, research D3 |
| `createdAt` | `DateTime` | Prisma-managed | constitution |
| `updatedAt` | `DateTime` | Prisma-managed | constitution |

Password is validated at input (8–72 characters, clarified #4) and **never stored in any form except the hash**.

### Session

| Field | Type | Constraints / Rules | Origin |
|---|---|---|---|
| `id` | `String` (cuid, PK) | opaque bearer claim carried inside the Auth.js JWT cookie | research D1, D2 |
| `userId` | `String` (FK → `User.id`) | `onDelete: Cascade` | FR-010, US4 |
| `expiresAt` | `DateTime` | always `lastProtectedInteraction + 30 days` (sliding) | FR-011, clarification #3 |
| `createdAt` | `DateTime` | Prisma-managed | research D11 |

## Relationships

- `User 1 — * Session` — one Session row per active sign-in (no per-user cap in this feature's scope; US4 "many sessions" edge case covered).

## Indexes

| Index | Table | Purpose |
|---|---|---|
| `email @unique` | User | uniqueness enforcement (constitution II) + O(1) lookup at sign-in |
| `@@index([userId])` | Session | per-user session queries, cascade integrity |
| `@@index([expiresAt])` | Session | opportunistic stale-session cleanup |

## Session state transitions

```
            register / sign-in success
                      │
                      ▼
   ┌─────────────── CREATED (expiresAt = now + 30d)
   │                       │
   │  protected interaction (every one)         [sliding, FR-011]
   │                       ▼
   ├────────────── RENEWED (expiresAt = now + 30d) ──┐
   │                       │                          │ loops while valid
   │   expiresAt <= now / row deleted                │
   │                       ▼                          │
   ├── EXPIRED / REVOKED ── next validation → unauthenticated, stale row deleted opportunistically
   │                                                  │
   └── signOut action → row deleted (REVOKED); all other tabs lose access on next protected interaction
```

- **Expired** (`expiresAt <= now`): the next validation treats the session as unauthenticated and deletes the stale row — identical UX to sign-out (redirect to sign-in).
- **Revoked** (sign-out): row deleted; the JWT claim no longer resolves anywhere — the multi-tab edge case resolves with one DELETE.

## Security invariants (constitution I — checked in every code review)

1. `passwordHash` never appears in an action result, page prop, log line, or API response.
2. Identity always derives from `requireSession()` (JWT claim → DB row), never from client-supplied identifiers (FR-010).
3. Sessions are server-revocable: deleting the row invalidates the JWT everywhere instantly.
4. Hash comparison uses `crypto.timingSafeEqual`; the unknown-email sign-in path runs a dummy verification so both branches cost the same (research D6).
5. Email is canonical (normalized) before storage and comparison — the case/whitespace-variance edge case can never match two different rows.

## Validation rules (from requirements, single Zod source)

| Schema | Rules |
|---|---|
| `registerSchema` | name 1–80 trimmed; email RFC-lite + ≤254 + normalized; password 8–72 |
| `signInSchema` | email RFC-lite + ≤254 + normalized; password 8–72 |

Limits exist to block oversized-input abuse; the 72-char password ceiling keeps hashing input bounded (clarified #4). No complexity rules on passwords (spec decision).

## Traceability

- `User` ← FR-001, FR-002, FR-003, US1, US2, constitution data model.
- `Session` ← FR-010, FR-011, US4, multi-tab + expiry + sliding-window edge cases.
- F001's `health_check` scratch table remains infrastructure-only and is untouched.
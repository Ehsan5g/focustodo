# Contract: Routes, Guards, and Session Semantics

## Route map

| Route | Group | Access | Behavior |
|---|---|---|---|
| `/` | `(protected)` | signed-in only | F001 application shell (protected area); signed-out → redirect to `/sign-in?next=<path>` (FR-012) |
| `/sign-in` | `(auth)` | public | sign-in view; captures `?next=` |
| `/register` | `(auth)` | public | registration view |
| `/api/health` | — | public | F001 infrastructure probe — excluded from protection (no user data) |

## Guard rules (two layers — research D8)

1. **`middleware.ts` (edge, advisory)**: coarse check of session cookie/JWT presence via edge-safe `auth.config.ts`; redirects unauthenticated visitors to `/sign-in` and appends `?next=<original path>`. No DB access here (Prisma is not edge-compatible). Matcher excludes `/api/health`, `/_next/*`, and static assets.
2. **`(protected)` layout (authoritative)**: `requireSession()` — resolves the JWT, validates the DB `Session` row, extends `expiresAt` (sliding window). Invalid/expired/missing → redirect to `/sign-in?next=<current path>`. Nothing protected renders before this passes.
3. **`(auth)` layout (reverse guard)**: a *valid* session redirects to the protected area (FR-009 — no `returnTo` handling here; already-authenticated users don't need auth views).
4. Any future protected mutation must call `requireSession()` itself (one missed call is a security hole — research D9).

## `next` (returnTo) semantics — clarified FR-008

| Aspect | Rule |
|---|---|
| Capture | middleware + `(protected)` layout append the requested path as `?next=` on the sign-in redirect |
| Honor | after successful sign-in, the destination is redirected to **as-is, including external URLs** — deliberately accepted open-redirect posture (spec Edge Case; reversible via one-line FR-008 change) |
| Absent | default destination: the protected area |
| Registration | always lands in the protected area (no returnTo in the US1 flow) |

## Session semantics (sliding 30-day — clarified FR-011)

| Event | Effect |
|---|---|
| register / sign-in success | `Session` row created; `expiresAt = now + 30 days` |
| any protected interaction (page load/navigation through the guarded layout; any `requireSession()` in an action) | `expiresAt = now + 30 days` (one renewal write per request, request-cached) |
| 30 days without any protected interaction | next interaction is unauthenticated (redirect to sign-in); stale row deleted |
| sign-out | row deleted + cookie cleared; other tabs revoked on their next protected interaction |

No absolute cap: continuous activity keeps a session alive indefinitely (clarified answer 3).

## Environment contract (research D13)

- `AUTH_SECRET`: required, minimum length 32; validated fail-fast by `src/lib/env.ts`; documented in `.env.example`. Missing/weak → startup exits with one actionable message, never a stack trace.

Details: [server-actions.md](server-actions.md) for the mutation contract; [../data-model.md](../data-model.md) for entities; [../research.md](../research.md) D1–D2 for the session architecture.
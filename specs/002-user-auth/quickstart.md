# Quickstart: Validating User Authentication (F002)

Runnable validation for the F002 acceptance criteria. Entity/contract details: [data-model.md](data-model.md), [contracts/server-actions.md](contracts/server-actions.md), [contracts/routes-and-guards.md](contracts/routes-and-guards.md).

## Prerequisites

- F001 baseline working: Node.js 22, npm, Docker (PostgreSQL container), dependencies installed.
- `.env` contains `DATABASE_URL` (F001) **and** `AUTH_SECRET` (new, ≥32 characters — see `.env.example`; a missing one fails startup with a single actionable message, D13).

## Setup

```bash
docker compose up -d      # PostgreSQL (F001)
npm install
npx prisma migrate dev    # applies the User + Session migration (first business tables)
npm run dev
```

## Manual validation scenarios

| # | Scenario (FR) | Steps | Expected |
|---|---|---|---|
| S1 | Register + auto sign-in (FR-001, FR-006) | Visit `/register`, enter valid name / email / password (8–72) | Lands in the protected area, already signed in — no second sign-in step |
| S2 | Duplicate email incl. case variance (FR-005, edge case) | Register again with the same email typed with different case/whitespace | Inline email error "already registered" — normalization makes variants collide |
| S3 | Invalid inputs (FR-001, FR-004, FR-013) | Submit empty fields, a 7-char password, an oversized email | Inline errors next to the relevant fields; nothing saved |
| S4 | Sign in + generic failure (FR-004, FR-005) | Sign out; sign in with wrong password; then with an unknown email | Both show the identical generic "Invalid email or password" |
| S5 | Return destination (FR-008, clarified) | While signed out, open a protected URL → get redirected to `/sign-in?next=…` → sign in | Returned to the original destination — honored as-is, including external URLs (accepted open-redirect) |
| S6 | Signed-in bounce (FR-009) | While signed in, open `/sign-in` or `/register` | Bounced to the protected area |
| S7 | Sign-out + back button (FR-006) | Click "Sign out"; press browser Back | Sign-in view shown; protected content is NOT served from cache/history |
| S8 | Multi-tab revocation (edge case) | Open two tabs signed in; sign out in tab A; interact with tab B | Tab B is redirected to sign-in on its next interaction |
| S9 | Session expiry + sliding window (FR-011) | (a) Set a session's `expiresAt` to the past in the dev DB, reload a protected page; (b) use the app normally for days | (a) Redirected to sign-in; (b) the 30-day countdown keeps extending on every interaction — no forced re-login while active |
| S10 | UX & accessibility (FR-013, constitution V) | Keyboard-only walk of both forms; submit and watch states | Visible focus, labeled fields, inline errors, pending state, friendly messages only |

Database sanity check after S1: the user row shows `passwordHash = scrypt$…` — never plaintext.

## Automated quality gates (all must pass)

```bash
npm run typecheck      # TypeScript strict — 0 errors
npm run lint           # ESLint — clean
npm run format:check   # Prettier — clean
npm run test           # Vitest unit + component (schemas, password service, session logic, both forms)
npm run test:e2e       # Playwright: S1–S9 journeys incl. forged-identity, multi-tab sign-out, expiry simulation
```

## Expected end state

Every scenario above passes; protected content is unreachable without a valid server-side session; sessions revoke and slide exactly per the clarified spec; no credentials or hashes appear in any response or log.
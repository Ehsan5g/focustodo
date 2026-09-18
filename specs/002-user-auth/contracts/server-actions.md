# Contract: Auth Server Actions

Public mutation surface of F002. Constitution: every mutation is a server action following the five-step contract; raw database objects are never returned to the client.

## Result shapes (predictable union — the only thing actions return)

```ts
type FieldErrors = { field: "name" | "email" | "password"; message: string }[];

type ActionResult =
  | { status: "success"; redirectTo: string }              // where the form should navigate
  | { status: "validation_error"; fieldErrors: FieldErrors }
  | { status: "failure"; message: string };                // generic, user-friendly; no internals
```

### `register(input)` → `ActionResult`

| Step | Behavior |
|---|---|
| 1. Validate | `registerSchema` (shared Zod): name 1–80 trimmed, email ≤254 + pattern + normalized, password 8–72 |
| 2. Authenticate | N/A — public action |
| 3. Authorize | N/A |
| 4. Execute | email taken (normalized lookup) → stop with email field error; else `hashPassword` → create `User` → create first `Session` → server-side sign-in |
| 5. Return | `success(redirectTo: protected area)` · `validation_error` · `failure` |

Notes: an email already registered (any case/whitespace variant — normalized comparison) yields **`validation_error` with a field error on `email`** (friendly message: "This email is already registered. Try signing in instead."). Returning `{ ok }`-style success only — no `User` object crosses the boundary.

### `signIn(input)` → `ActionResult`

| Step | Behavior |
|---|---|
| 1. Validate | `signInSchema` (shared Zod) |
| 2. Authenticate | N/A — public by definition |
| 3. Authorize | N/A |
| 4. Execute | fetch user by normalized email; **unknown email → run dummy scrypt verification, then generic failure** (timing equalization); known email → `verifyPassword` (`timingSafeEqual`); on match create `Session` + sign in |
| 5. Return | `success(redirectTo: returnTo honored AS-IS — incl. external URLs (clarified FR-008); default: protected area)` · `failure("Invalid email or password")` |

The single generic message covers unknown email AND wrong password — never distinct, never technical (FR-005).

### `signOut()` → `ActionResult`

| Step | Behavior |
|---|---|
| 1. Validate | no input |
| 2. Authenticate | resolve current session, if any |
| 3. Authorize | signing out one's own session is always allowed |
| 4. Execute | delete the `Session` row |
| 5. Return | `success(redirectTo: sign-in view)`; cookie cleared |

Effect: every other tab loses access on its next protected interaction (multi-tab edge case = one DELETE).

## Error mapping (constitution V — friendly, never technical)

| Condition | Client-visible result |
|---|---|
| Zod issues | `validation_error` + inline messages near the relevant field |
| duplicate email | field error on `email` (friendly) |
| unknown email / wrong password | generic `failure` message ("Invalid email or password") |
| unexpected error | generic "Something went wrong. Please try again." + server-side diagnostic log |

## Non-negotiables

- The server re-validates every input even though the client also validates (constitution I).
- The five steps are visible, in order, in every action body.
- No logging of passwords, hash material, or session ids.
- Prisma usage confined to `src/server/` (F001 skeleton rule).

Details: [routes-and-guards.md](routes-and-guards.md) for redirect/destination semantics; [../data-model.md](../data-model.md) for entities.
# Contract: Error Responses & Logging (F009)

Defines what clients may observe when something fails and what the server logs. Implements the error-handling requirements (US2) and constitution V.

## Server action result shape (existing contract, completed catalog)

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };
```

`message` is always user-safe (English, no internals). `ErrorCode` is the closed union below.

## Error catalog

| Code | When | User message | Server log level |
|---|---|---|---|
| VALIDATION | Zod schema failure | field-specific messages near the field | info (no values) |
| AUTH_INVALID_CREDENTIALS | login failure below throttle threshold | "Invalid email or password." | info |
| AUTH_RATE_LIMITED | throttle threshold reached | "Too many sign-in attempts. Please try again later." | warn |
| UNAUTHORIZED | no session / missing user for a protected action | "Please sign in to continue." | info |
| FORBIDDEN | authenticated but not the owner | "You don't have access to this item." | warn |
| NOT_FOUND | missing task/category/page | "This item doesn't exist or was removed." | info |
| CONFLICT | duplicate category name per user | "You already have a category with this name." | info |
| DATABASE | Prisma/PostgreSQL failure | "Something went wrong. Please try again." | error + stack |
| NETWORK | client transport failure | "Connection problem. Check your network and try again." | warn |
| UNEXPECTED | anything else | "Something went wrong. Please try again." | error + stack |

## Router boundaries

- `error.tsx`: segment-level fallback with a "Try again" (reset) action.
- `global-error.tsx`: root crash fallback (plain, minimal, includes reload guidance).
- `not-found.tsx`: friendly 404 with a link back to the dashboard.

## Logging contract (server-side only)

- Always logged: timestamp, error code, message, stack (for error/warn levels), userId when authenticated, route/action name.
- Never logged: passwords, tokens, cookies, full request bodies, raw SQL, environment values, rate-limit bucket contents.
- The client never receives stack traces, SQL, provider errors, or environment details.

## HTTP mapping (route handlers, e.g. /api/health)

200 ok · 401 unauthenticated · 403 forbidden · 404 not found · 429 rate-limited · 500 unexpected · 503 dependency down.
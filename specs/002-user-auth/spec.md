# Feature Specification: User Authentication & Authorization (F002)

**Feature Branch**: `002-user-auth`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "F002 — Authentication Register Login Logout Protected routes Session Authorization"

## Clarifications

### Session 2026-09-16

- Q: After a successful sign-in, should the "return to the originally requested destination" behavior be restricted to in-application destinations only? → A: No — the saved destination is honored as-is, including external URLs (an in-app-only restriction is deliberately not adopted).
- Q: Should email addresses be normalized (trimmed and lowercased) before uniqueness checks and sign-in matching? → A: Yes — trim and lowercase on registration and sign-in; `John@X.com` and `john@x.com` are the same address.
- Q: What concrete session validity window and renewal policy should replace the "order of weeks, planning-phase" default? → A: B — a sliding 30-day window: every protected interaction resets the countdown to 30 days; a continuously active user is never forced to re-authenticate, while an idle session expires 30 days after its last protected interaction.
- Q: What documented maximum input lengths should apply to passwords and email addresses? → A: Password maximum 72 characters; email maximum 254 characters (72 aligns with the byte limit of common one-way password hash algorithms so hashing never silently truncates; 254 is the RFC-aligned email limit).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Account Registration (Priority: P1)

A new visitor opens the registration view, enters a name, email address, and password, and submits. Valid information creates the account and signs the visitor in, bringing them into the protected application area. Invalid or duplicate information is rejected with clear, field-level guidance, and no account is created.

**Why this priority**: Registration is the entry point to every other capability; without accounts, no one can ever use the product.

**Independent Test**: Can be fully tested by registering with valid data (account created, user signed in), then with a duplicate email and with invalid data (both rejected with clear errors, no account created) — delivers the product's front door.

**Acceptance Scenarios**:

1. **Given** a visitor on the registration view, **When** they submit a valid name, an unused email, and an acceptable password, **Then** the account is created, the visitor is signed in, and they land in the protected application area.
2. **Given** a visitor submitting an email that already belongs to an account, **When** the registration is processed, **Then** it is rejected with a clear message, no second account exists, and the entered data (except the password) is preserved for correction.
3. **Given** a visitor submitting invalid data (malformed email, too-short password, missing name), **When** the registration is processed, **Then** each offending field shows a specific, understandable error near the field and no account is created.
4. **Given** a visitor who submits the registration form repeatedly (double-click or resubmit), **When** the submissions are processed, **Then** at most one account is created and the outcome is consistent.

---

### User Story 2 - Sign In and Sign Out (Priority: P1)

A returning user opens the sign-in view, enters their email and password, and is taken into the protected application area. From any authenticated page, the user can sign out; afterwards, protected content is no longer reachable until they sign in again.

**Why this priority**: Sign-in is how every returning session begins and sign-out is the user's primary control over their session — together they form the daily loop of the product.

**Independent Test**: Can be fully tested by signing in with correct credentials (access granted), signing out (access revoked), and signing in with wrong credentials (clearly rejected) — delivers the core trust boundary of the product.

**Acceptance Scenarios**:

1. **Given** a registered user with correct credentials, **When** they submit the sign-in form, **Then** they are signed in and land in the protected application area.
2. **Given** a submitted sign-in with a wrong password or an unknown email, **When** it is processed, **Then** a single generic error is shown (the message does not reveal whether the email exists) and the user may retry.
3. **Given** a signed-in user on any authenticated page, **When** they choose to sign out, **Then** the session ends, they are returned to the public area, and protected content is no longer reachable.
4. **Given** a sign-in attempt with empty or malformed fields, **When** it is processed, **Then** field-level validation messages appear near the fields and the user is not misled by a vague failure.

---

### User Story 3 - Protected Routes and Redirects (Priority: P1)

The protected application area is unreachable for signed-out visitors. Any attempt — direct address entry, browser refresh, or back-button navigation — leads to the sign-in view, and after a successful sign-in the visitor is returned to the destination they originally wanted. Signed-in users who open the sign-in or registration views are sent back to the protected area.

**Why this priority**: This is the enforcement half of authentication — without airtight route protection, accounts and sessions protect nothing.

**Independent Test**: Can be fully tested signed-out by attempting to open several protected destinations (each must redirect to sign-in with no content exposure), signing in, and confirming the return to the intended destination — plus the reverse check signed-in on the sign-in and registration views — delivers verified access control.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they attempt to open any protected destination directly, **Then** they are redirected to the sign-in view — never shown protected content, not even momentarily.
2. **Given** a visitor redirected to sign-in from a protected destination, **When** they sign in successfully, **Then** they are taken to that originally requested destination.
3. **Given** a signed-out visitor using browser back navigation after a redirect or after sign-out, **When** previously viewed content would reload, **Then** no protected content is exposed.
4. **Given** a signed-in user, **When** they open the sign-in or registration view, **Then** they are redirected to the protected application area.

---

### User Story 4 - Trustworthy Sessions and Auth-State-Aware Interface (Priority: P2)

Identity for every protected operation comes from the server-side session — never from anything the browser claims about who the user is. The session survives browser restarts within its sliding 30-day validity window, ends at sign-out, and its expiry is handled gracefully. The interface reflects the current authentication state everywhere: signed-out visitors see entry points to sign in or register; signed-in users see their own name and a sign-out control.

**Why this priority**: Session trustworthiness is the security foundation required by the constitution (the server is the only source of truth for identity), while the state-aware interface is the visible layer that makes that security usable; both build on the completed P1 stories.

**Independent Test**: Can be fully tested by presenting the server with client-supplied identity signals (forged or mismatched) and confirming they are ignored, restarting the browser mid-session (state retained), letting a session expire (graceful re-authentication), and checking the interface in both authentication states — delivers verifiable session integrity.

**Acceptance Scenarios**:

1. **Given** any request carrying a browser-supplied user identifier that does not match the server-side session, **When** the server processes it, **Then** the browser-supplied value is ignored or rejected — the server-derived identity always wins.
2. **Given** a signed-in user who closes and reopens the browser within the session validity window, **When** they return, **Then** they are still signed in without re-entering credentials.
3. **Given** a session that has expired, **When** the user attempts any protected action, **Then** they are redirected to sign-in with a clear, non-technical explanation and can resume after signing in.
4. **Given** the application viewed signed-out, **When** any page renders, **Then** it shows sign-in/registration entry points and no user-specific content.
5. **Given** the application viewed signed-in, **When** any authenticated page renders, **Then** it shows the signed-in user's name and a functioning sign-out control.

---

### Edge Cases

- Duplicate email at registration: rejected with a clear message; exactly one account exists for any email.
- Email entered with different letter case or surrounding whitespace than at registration: normalized (trimmed and lowercased) before comparison — treated as the same address; sign-in still matches and duplicate registration is still caught.
- Wrong password versus unknown email at sign-in: one and the same generic error (no account enumeration).
- Malformed or forged session credential: rejected server-side; the user is treated as signed out and protected actions redirect to sign-in.
- Session expiry mid-task: the next protected action redirects to sign-in with a clear explanation; after re-authentication the user can resume; nothing is silently lost or corrupted.
- Repeated or double form submission: registration never creates more than one account; repeated sign-in submissions are harmless.
- Extremely long or crafted inputs (names, emails, passwords): constrained by the documented limits (name 80, email 254, password 72 characters) and rejected with validation messages rather than unexpected behavior.
- Signing out in one browser tab while another tab of the same application is open: the other tab no longer permits protected actions (its next attempt redirects to sign-in).
- Crafted redirect destination (e.g., an external URL) supplied to the sign-in view: honored as-is after sign-in per clarification — the post-login open-redirect exposure is accepted for this feature; no in-app-only restriction is enforced.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let visitors create an account by providing a name, an email address, and a password; the email address MUST be at most 254 characters and MUST be normalized (trimmed and lowercased) before it is stored or checked, and MUST be unique across all accounts after normalization.
- **FR-002**: Passwords MUST be between 8 and 72 characters (inclusive) and MUST be stored only in an unreadable, one-way-protected form; plaintext passwords MUST never be stored, logged, or exposed to the client.
- **FR-003**: Registration and sign-in inputs MUST be validated for user convenience AND MUST be re-validated authoritatively on the server; the server MUST reject invalid input regardless of what the client checked.
- **FR-004**: Registered users MUST be able to sign in with their email and password, with the submitted email normalized the same way (trimmed and lowercased) before matching; a successful sign-in grants access to the protected application area.
- **FR-005**: A failed sign-in MUST show one generic error message regardless of whether the email is unknown or the password is wrong (no account enumeration); error messages MUST be user-friendly and MUST never expose sensitive server details.
- **FR-006**: Signed-in users MUST be able to sign out from any authenticated page; after sign-out, protected content MUST be unreachable until re-authentication.
- **FR-007**: The protected application area MUST be inaccessible to signed-out visitors; every attempt MUST redirect to the sign-in view without exposing protected content.
- **FR-008**: After a redirect to sign-in caused by a protected destination, a successful sign-in MUST return the user to that originally requested destination, honored as-is — including destinations outside the application (per clarification: no in-app-only restriction is applied).
- **FR-009**: Signed-in users opening the sign-in or registration views MUST be redirected to the protected application area.
- **FR-010**: The identity used for every protected operation MUST be derived from the server-side session; a user identifier supplied by the browser MUST NOT be accepted as a source of truth.
- **FR-011**: Sessions MUST persist across browser restarts within a sliding 30-day validity window — every protected interaction resets the countdown to 30 days — MUST end at sign-out, and MUST expire gracefully: after expiry, the next protected action redirects to sign-in with a clear explanation.
- **FR-012**: Every page MUST reflect the current authentication state: signed-out visitors see sign-in/registration entry points and no user-specific content; signed-in users see their name and a working sign-out control.
- **FR-013**: Registration and sign-in forms MUST be fully keyboard-operable with visible focus, clearly labeled fields, inline errors displayed near the relevant field, and visible loading/success/failure states on submission (accessibility per constitution).
- **FR-014**: Failed submissions MUST NOT lose the user's entered data (except password fields, which are cleared); repeated submissions MUST NOT create duplicate accounts or inconsistent outcomes.
- **FR-015**: Automated end-to-end verification MUST cover registration, sign-in, sign-out, redirect behavior, and rejection of mismatched browser-supplied identity, and MUST pass on the untouched feature (constitution test-first gates).

### Constraints *(user-mandated)*

The following come from the ratified constitution and the feature description and are treated as requirements:

- Authentication and session handling MUST use the constitution-mandated mechanism (Auth.js) with server sessions — not custom-built cryptography or hand-rolled session logic.
- All form input validation schemas MUST be shared between client and server as a single source of truth (Zod, per constitution).
- Mutations (registration, sign-in, sign-out) MUST go through server actions following the constitution's five-step contract: (1) validate input, (2) authenticate, (3) authorize, (4) execute, (5) return a predictable result.
- The feature builds on the F001 foundation stack (Next.js 16, TypeScript strict, Tailwind/shadcn, Prisma, PostgreSQL) without adding new runtime libraries without documented justification.

### Key Entities *(include if feature involves data)*

- **User**: a person with an account — id, name, unique email address (stored normalized: trimmed and lowercased), a one-way-protected password credential, and creation/update timestamps. Owns all future private data (tasks and categories arrive with later features).
- **Session**: a signed-in period for exactly one user — valid within a sliding 30-day window (extended on each protected interaction), ended by sign-out or expiry. The sole trusted source of identity for every protected operation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor with valid information can register and land in the protected area in under 2 minutes, with the registration step itself completing in under 2 seconds under normal local conditions.
- **SC-002**: Sign-in completes in under 2 seconds under normal local conditions, and 95% of attempts with correct credentials succeed on the first try.
- **SC-003**: 100% of automated attempts by signed-out users to open representative protected destinations result in a redirect to sign-in with zero protected-content exposure (verified by automated end-to-end tests).
- **SC-004**: After sign-out, 100% of attempts to reach protected content — including browser back navigation — end in a redirect; no protected content is ever exposed.
- **SC-005**: Zero occurrences of plaintext passwords in storage, logs, error messages, or client-visible responses (verified by targeted review and tests).
- **SC-006**: Duplicate-email registration is rejected 100% of the time with clear feedback; the system never ends up holding two accounts for one email address.
- **SC-007**: 100% of the automated end-to-end tests covering registration, sign-in, sign-out, redirects, and forged-identity rejection pass on the completed feature.
- **SC-008** *(qualitative)*: A first-time user can register and sign in without instructions; every error message is understandable without technical knowledge.

## Assumptions

Scope boundaries (explicitly out of scope for this feature):

- Password reset / forgot-password, email verification, and email changes are later features; not included here.
- Social sign-in (OAuth/SSO), two-factor authentication, and login rate-limiting or account-lockout hardening are not included; only email + password with the mandated session mechanism.
- User profile editing (name change, avatar) and account deletion are separate later features.
- A single user role exists in this feature; role-based administration arrives only if later features need it.

Defaults chosen where the description was silent (documented for review):

- Registration collects name, email, and password (matching the constitution's User contract); the password is 8–72 characters, the email is at most 254 characters, and the name is limited to a reasonable documented maximum (80 characters).
- Session validity is a sliding 30-day window: every protected interaction resets the countdown to 30 days (pinned during clarification); a continuously active user is never forced to re-authenticate, while an idle session expires 30 days after its last protected interaction.
- Exact page addresses for sign-in, registration, and the protected area are planning-phase decisions; this spec deliberately speaks of views and areas, not URL paths.
- UI text is English; error messages use friendly, non-technical wording per the constitution's UX principles.
- The protected area's content in this feature is the F001 application shell; business content (tasks, categories) arrives with later features.

Dependencies:

- Requires the F001 foundation (runnable app, data layer, quality gates) to be in place; this feature is the first consumer of the database baseline and its User data model.


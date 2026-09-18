# Feature Specification: Production Hardening (F009)

**Feature Branch**: `009-production-hardening`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "F009 — Production Hardening: security review, performance review, accessibility review, error handling, README, Docker, environment configuration"

## Clarifications

### Session 2026-09-16

- Q: How strict should the performance budgets be for dashboard, task list, filtering, sorting, search, and form submissions with hundreds of tasks? → A: Strict budgets — task list, filtering, and sorting complete within 500 ms; dashboard, search, and form submissions within 1 second, measured on the reference dataset
- Q: Should the security review's checklist explicitly cover login brute-force protection — verifying that repeated failed sign-in attempts get throttled? → A: Yes, as a blocking review item — failed sign-ins must be throttled; a missing throttle is a finding that must be fixed before release
- Q: Which real screen readers must the accessibility review be verified with? → A: NVDA on Windows plus one mobile screen reader (VoiceOver on iOS or TalkBack on Android)
- Q: What machine should "ordinary hardware" mean when the performance budgets are measured? → A: A low-end stress baseline — 2 CPU cores and 4 GB RAM, with the containers running locally

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Security Review Proves the App Is Safe to Expose (Priority: P1) 🎯 MVP

Before the application faces real users, a systematic, checklist-driven security review walks every account, task, and category operation and re-proves the five-step contract — validation, authentication, authorization, business logic, predictable result. It audits for exposed secrets, vulnerable dependencies, unsafe handling of passwords and sessions, and missing throttling of repeated failed sign-ins, and every hole it finds is closed before release.

**Why this priority**: Security is the constitution's non-negotiable principle; a single authorization hole or leaked secret betrays every user of everything built in F001–F008. Nothing ships until this passes.

**Independent Test**: Can be fully tested by executing the review checklist across all operations and confirming every cross-user probe is denied with a generic response and no secrets exist in code, configuration, or images — delivering confidence that the app is deployable.

**Acceptance Scenarios**:

1. **Given** the completed application, **When** the security review walks every task, category, and account operation, **Then** each operation re-confirms server-side validation, authentication, authorization, and a predictable result with nothing sensitive exposed to the client
2. **Given** a probe that attempts cross-user access through any supported path, including directly crafted requests, **When** it is executed, **Then** access is denied with a generic response revealing nothing about existence, ownership, or content
3. **Given** the repository, configuration files, and built deployment artifact, **When** they are audited, **Then** no secrets, credentials, or sensitive authentication data are present in code or images, and all sensitive values are supplied only through environment configuration
4. **Given** repeated failed sign-in attempts against the login endpoint, **When** the throttle threshold is exceeded, **Then** further attempts are throttled — and a missing throttle recorded by the review is a blocking finding fixed before release

---

### User Story 2 - Nothing Fails Rudely — Graceful Error Handling Everywhere (Priority: P1)

Every failure a user can trigger — unexpected server errors, missing pages, rendering failures — produces a calm, friendly response: their input is preserved, they know what happened in plain language, they can retry, and technical detail stays in server-side logs where it helps diagnosis instead of confusing users or aiding attackers.

**Why this priority**: Unhandled errors are both a trust-killer and a security leak (stack traces expose internals); the constitution requires every error class to map to a friendly message with diagnostics logged server-side.

**Independent Test**: Can be fully tested by forcing each error class and observing a friendly user-facing message, preserved input, a recoverable state, and complete server-side logging with zero technical leakage.

**Acceptance Scenarios**:

1. **Given** an unexpected server failure during any operation, **When** it occurs, **Then** the user sees a friendly message with their input preserved and can retry, while the full technical detail is logged server-side only
2. **Given** a URL that does not exist, **When** it is visited, **Then** a friendly not-found page with a clear way home appears — never a raw error
3. **Given** a rendering failure in part of the interface, **When** it occurs, **Then** an error boundary contains it with a recovery message instead of a blank or broken screen

---

### User Story 3 - A Performance Review Confirms the App Stays Fast (Priority: P2)

A measured pass over the whole application verifies explicit performance budgets — task list, filtering, and sorting within 500 ms; dashboard, search, and form submissions within 1 second — against realistic data volumes on ordinary devices. Every miss is fixed or consciously accepted; nothing slow ships by accident.

**Why this priority**: The constitution demands a professional feel on every device and database queries that fetch only what they need; speed that silently degrades as data grows breaks the product's core promise.

**Independent Test**: Can be fully tested by loading a reference dataset (hundreds of tasks), measuring each interaction against its budget, and confirming every result is recorded with misses fixed or explicitly accepted.

**Acceptance Scenarios**:

1. **Given** a user with hundreds of tasks, **When** they open the dashboard or task list and apply filters and sorting, **Then** results appear within the strict budgets (500 ms for list, filter, and sort interactions; 1 second for dashboard views) on ordinary hardware with no perceptible lag
2. **Given** the performance review, **When** each budget is measured, **Then** every result is recorded, and any miss is fixed or explicitly accepted with a written rationale

---

### User Story 4 - An Accessibility Review Confirms Everyone Can Use It (Priority: P2)

A review pass beyond the automated component tests verifies that real people using only a keyboard — or a screen reader — can complete the critical journeys end to end, with visible focus, meaningful labels and announcements, sufficient contrast, and status and priority never conveyed by color alone.

**Why this priority**: Accessibility is a constitution requirement (semantic HTML, keyboard navigation, visible focus, contrast); component tests prove the parts, this review proves the whole journeys work for everyone.

**Independent Test**: Can be fully tested by completing registration through logout using keyboard only and by traversing key pages with a screen reader, confirming every control is operable, announced, and never color-only.

**Acceptance Scenarios**:

1. **Given** keyboard input only, **When** a user completes registration, login, task create/edit/complete/delete, and logout, **Then** every control is reachable and operable with visible focus and no keyboard traps
2. **Given** NVDA on Windows and one mobile screen reader, **When** key pages are used, **Then** content, states, and errors are announced meaningfully, and status and priority are never conveyed by color alone

---

### User Story 5 - The App Runs Identically Anywhere — Containers and Configuration (Priority: P2)

The application ships as a container alongside its database, started with one documented command on any machine with a container runtime. Every setting the app needs arrives through environment configuration, documented in a template file; a missing or invalid value stops startup immediately with a message that names the problem, and secrets never live inside the image.

**Why this priority**: "Works on my machine" is a release blocker; the constitution fixes the stack including container-based local infrastructure, and hardening it for production makes deployment boring and repeatable.

**Independent Test**: Can be fully tested on a clean machine by following the one-command startup, then by removing a required configuration value and confirming a fail-fast startup message naming it.

**Acceptance Scenarios**:

1. **Given** a clean machine with only a container runtime, **When** the documented one-command startup is followed, **Then** the application and its database start and the app is fully usable
2. **Given** a required configuration value that is missing or invalid, **When** the application starts, **Then** it fails immediately with a message naming the problem — never a silent wrong default or a cryptic crash later
3. **Given** a built deployment image, **When** it is inspected, **Then** it contains no secrets, and every environment variable the app reads is documented in a template configuration file

---

### User Story 6 - The README Makes the Project Self-Explanatory (Priority: P3)

The README is complete and current: what the product is, its features, the technology stack and architecture, project structure, every environment variable, local development and database setup, how to run tests and end-to-end tests, the AI-assisted workflow, and key architectural decisions. A newcomer reaches a running application by following it alone.

**Why this priority**: The constitution mandates a professional README covering exactly these topics; it does not gate runtime behavior, but without it the project is unrunnable by anyone new.

**Independent Test**: Can be fully tested by having a fresh contributor follow the README top to bottom on a clean machine and reach a running, tested application without external help.

**Acceptance Scenarios**:

1. **Given** a new contributor on a clean machine, **When** they follow the README top to bottom, **Then** they reach a running application — including database setup, configuration, and tests — without outside help
2. **Given** any configuration variable, **When** it is looked up in the README, **Then** its purpose, expected format, and default are documented

### Edge Cases

- What happens when a configuration value has a valid format but is wrong (for example, pointing at a database that does not exist)? Startup fails with a clear message naming the component that could not be reached — never a silent wrong default or a cryptic crash later.
- What happens when a secret is accidentally committed? The security audit catches it before release; the response procedure is to rotate the secret immediately and remove it from the repository, then add a regression check.
- What happens when the application starts before its database is ready? Startup waits and retries with clear status messaging instead of crash-looping silently or limping into a broken state.
- What happens when a user has thousands of tasks? The performance budgets still hold; if they cannot, the review records the limit and the fix (such as paging) is decided before release, never discovered by users.
- What happens when an error occurs inside the error handler itself? A minimal built-in fallback message is shown; the user never faces a blank screen or a raw error, and the double failure is logged server-side.
- What happens when a review finds a defect in an earlier feature? It is fixed under the F008 quality gates — the fix starts from a failing test — and the suite stays green; security findings block everything else.
- What happens when automated accessibility checks pass but real assistive technology struggles? Real keyboard and screen-reader passes are part of the review; discrepancies are defects to fix, not known limitations to document away.
- What happens when a brand-new user with zero data opens the hardened app? Empty states and friendly onboarding behavior are preserved; hardening must not degrade any F007 experience.
- What happens when the container is run on a different machine or platform? Behavior is identical; the review verifies the deployment artifact, not one lucky machine.
- What happens when errors dump diagnostic context into logs? Logs are screened so they never contain passwords, hashes, or other sensitive data, even in unexpected failure paths.
- What happens when the network drops mid-operation? The user gets a friendly message, the interface stays consistent with the server, and no half-saved data is left behind.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A security review MUST re-verify the five-step contract — validate input, authenticate, authorize, execute business logic, return a predictable result — for every account, task, and category operation, and MUST verify that repeated failed sign-in attempts are throttled, using a documented checklist whose findings are tracked to resolution or documented acceptance
- **FR-002**: Authorization MUST be re-proven across every supported access path, including directly crafted requests, with generic denials that reveal nothing about the existence, ownership, or content of other users' data
- **FR-003**: A secrets audit MUST confirm that no secrets, credentials, or sensitive authentication data exist in source code, configuration files, or built images; all sensitive values MUST arrive exclusively through environment configuration
- **FR-004**: A dependency audit MUST be performed, and every known high or critical vulnerability MUST be resolved or explicitly accepted with written rationale before release
- **FR-005**: Password and session handling MUST be reviewed to confirm hashes and sensitive authentication data are never exposed to the client and nothing sensitive is ever logged in plaintext
- **FR-006**: Every security fix MUST land with a regression test in the F008 suite; authorization findings block all other work until resolved
- **FR-007**: Every error class — validation, authentication, authorization, database, not-found, network, unexpected — MUST map to a user-friendly message with the user's input preserved and a recoverable state
- **FR-008**: Technical details, stack traces, and server or database specifics MUST never reach the client; full diagnostics MUST be logged server-side, and logs MUST never contain sensitive data
- **FR-009**: Unknown URLs MUST show a friendly not-found page, and rendering failures MUST be contained by error boundaries with recovery messages instead of blank or broken screens
- **FR-010**: Explicit performance budgets MUST be enforced: task list, filtering, and sorting complete within 500 ms; dashboard, search, and form submissions within 1 second — measured against a reference dataset of hundreds of tasks on ordinary hardware, defined as a low-end baseline machine with 2 CPU cores and 4 GB RAM running the containers locally
- **FR-011**: Every budget result MUST be recorded, and every miss MUST be fixed or explicitly accepted with a written rationale before release
- **FR-012**: An accessibility review MUST verify keyboard-only completion of the critical journeys (registration through logout) with visible focus and no keyboard traps, real screen-reader traversal of key pages with NVDA on Windows plus one mobile screen reader (VoiceOver on iOS or TalkBack on Android), sufficient contrast, and status and priority never conveyed by color alone
- **FR-013**: Findings from all reviews MUST be tracked in one place with severity, owner, and resolution, and nothing ships with an unresolved high-severity security finding
- **FR-014**: The application and its database MUST be deployable as containers, started with one documented command on any machine with a container runtime, with production behavior identical to development apart from configuration
- **FR-015**: All application configuration MUST be supplied through environment variables; a template configuration file MUST document every variable the app reads — purpose, expected format, and default
- **FR-016**: On missing or invalid configuration the application MUST fail fast at startup with a message naming the problem; silent wrong defaults are forbidden
- **FR-017**: Built images MUST contain no secrets; all sensitive values MUST be injected at runtime
- **FR-018**: The README MUST cover, and be kept current with: the product and its features, the technology stack and architecture, project structure, every environment variable, local development, database setup, tests and end-to-end tests, the AI-assisted workflow, and key architectural decisions

### Constraints *(user-mandated)*

- All seven hardening areas are non-negotiable deliverables: security review, performance review, accessibility review, error handling, README, Docker-based deployment, and environment configuration — the feature is not done until each has been executed and its findings resolved or explicitly accepted
- Security review is the constitution's non-negotiable principle in action: the server remains the only source of truth for identity and data access, every operation keeps server-side validation and authorization, and sensitive details never reach the client (Principle I)
- Accessibility, performance, and error handling MUST meet the constitution's production bar: semantic HTML, keyboard navigation, visible focus, contrast, status and priority never color-only; professional feel on every device; every error class mapped to a friendly message with diagnostics logged server-side (Principle V)
- Every hardening fix lands under the F008 quality gates: bug fixes start from failing tests, security fixes gain permanent regression tests, and the full suite stays green (Principle IV)
- The approved stack is fixed — Next.js with App Router, Prisma, PostgreSQL, container-based infrastructure included; hardening adds no new runtime libraries unless explicitly justified (Technology and Security Constraints)
- This is a hardening feature: no new user-facing capabilities; every change tightens, speeds, clarifies, or documents what F001–F008 already deliver
- Any tested server interaction continues to follow the five-step contract; builds on F001–F008 with the Definition of Done fully satisfied for every task

### Key Entities *(include if feature involves data)*

- **No new product entities**: hardening changes no user data model; Task, Category, and User remain exactly as defined since F002–F004
- **Environment configuration variables** (operational artifact): each has a name, purpose, expected format, and default; all are documented in a template configuration file and the README
- **Review findings** (process artifact): one tracked record per finding — review area, description, severity, owner, and resolution or documented acceptance

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All seven mandated review areas are completed, with every finding resolved or explicitly accepted and zero open high-severity security findings at release
- **SC-002**: 100% of cross-user access probes through every supported path are denied with generic responses — re-proven during hardening, not assumed from F008
- **SC-003**: The secrets audit passes with zero secrets in source code, configuration files, or built images
- **SC-004**: 100% of the strict performance budgets (≤500 ms task list, filtering, and sorting; ≤1 s dashboard, search, and form submissions) are met on the reference dataset (hundreds of tasks) on the defined baseline hardware, or carry a written, explicit acceptance
- **SC-005**: The critical journeys are completed keyboard-only with visible focus and zero keyboard traps, and key pages pass screen-reader verification with NVDA on Windows plus one mobile screen reader (VoiceOver on iOS or TalkBack on Android)
- **SC-006**: 100% of forced failure classes produce a friendly message with preserved input and a server-side log, and zero stack traces or internal details reach the client
- **SC-007**: A clean machine reaches a fully usable application — app, database, and configuration — by following the README's one command in under fifteen minutes
- **SC-008**: 100% of environment variables are documented in the template file and README, and the app fails fast naming the problem in 100% of missing-or-invalid configuration attempts

## Assumptions

- **Dependencies**: hardening builds on F001–F008; the F008 test suite stays green and gates every hardening change, and the security E2E scenario continues to pass throughout
- **Deployment scope**: single-instance container deployment; orchestration platforms, content delivery networks, and cloud-managed services are out of scope
- **Reference dataset**: performance budgets are measured with hundreds of tasks per user across multiple users; the strict budgets (500 ms list interactions, 1 s dashboard/search/submit) are recorded with the review
- **Review discipline**: every review is checklist-driven and produces tracked findings with resolution or documented acceptance — no ad-hoc eyeballing, no undocumented waivers
- **Security scope**: the review covers the application itself — server operations, routes, data access, client exposure, configuration, and dependencies; external penetration testing is out of scope
- **Fix discipline**: every hardening fix lands with its regression test per the F008 gates; authorization fixes block all other work; no new runtime libraries unless explicitly justified
- **Documentation scope**: the README is the single entry-point document maintained per the constitution's mandated topic list; architecture deep-dives beyond it are out of scope

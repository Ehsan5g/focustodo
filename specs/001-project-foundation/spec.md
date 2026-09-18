# Feature Specification: Project Foundation & Tooling (F001)

**Feature Branch**: `001-project-foundation`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "F001 — Foundation Next.js 16 TypeScript Tailwind shadcn Prisma PostgreSQL ESLint testing infrastructure"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reproducible Local Development Environment (Priority: P1)

A developer clones the repository on a machine that has the documented prerequisites, follows only the README from top to bottom, and reaches a running application backed by a running local database. No undocumented steps, no guesswork, no asking a teammate what to click.

**Why this priority**: Every later feature depends on a working, reproducible environment. Without it, nothing else can be built, demonstrated, or verified.

**Independent Test**: Can be fully tested by wiping the workspace (or using a clean machine), following the README setup steps verbatim, and confirming the application is reachable in a browser while its local database is running — delivers an immediately usable development environment.

**Acceptance Scenarios**:

1. **Given** a fresh clone with documented prerequisites installed, **When** the developer follows the README setup steps exactly as written, **Then** the application starts and is reachable in a browser without any manual fixes.
2. **Given** the environment is fully torn down (application stopped, local database removed), **When** the developer re-runs the documented setup, **Then** the environment is recreated completely without leftover manual state.
3. **Given** a required environment setting is missing or invalid, **When** the application starts, **Then** it fails fast with a clear, actionable message naming the missing or invalid item — never an internal stack trace.
4. **Given** the developer opens the README, **When** they look for any documented command, **Then** every command listed works verbatim as written.

---

### User Story 2 - Enforceable Quality-Gate Baseline (Priority: P1)

A developer runs the project's automated quality checks — type checking, linting, formatting, unit tests, component tests, and end-to-end smoke tests — each with a single documented command. On a clean checkout, every check passes. When a defect is introduced, the relevant check fails and points at the problem.

**Why this priority**: The project constitution makes quality gates non-negotiable for every future task; the gates must exist, be runnable, and pass from day one so every later change is measured against a working baseline.

**Independent Test**: Can be fully tested by running each documented check command on untouched code (all must pass), then introducing a deliberate defect and confirming the matching gate fails — delivers a trustworthy enforcement baseline.

**Acceptance Scenarios**:

1. **Given** untouched scaffold code, **When** type checking runs, **Then** it completes with zero errors.
2. **Given** untouched scaffold code, **When** linting runs, **Then** it completes with zero errors.
3. **Given** untouched scaffold code, **When** formatting enforcement runs, **Then** it reports the codebase as conforming (or reformats it deterministically).
4. **Given** untouched scaffold code, **When** the unit and component test suites run, **Then** all tests pass, including at least one sample test per layer proving each level of the test infrastructure works.
5. **Given** the application running locally, **When** the end-to-end smoke suite runs, **Then** it passes by loading the application and verifying the primary shell is visible and usable.
6. **Given** a deliberate defect (a type error, a lint violation, and a broken assertion), **When** the corresponding checks run, **Then** each fails and reports the failing location.

---

### User Story 3 - Working Data Layer (Priority: P2)

The application can store and retrieve data through its data layer against the local database: a brand-new empty database can be created and brought to the current schema with documented commands, and a health verification proves the full write-and-read round trip, with data surviving restarts.

**Why this priority**: All upcoming features are data-backed; the persistence plumbing must be proven end-to-end before features build on it.

**Independent Test**: Can be fully tested by deleting the local database, recreating it from the documented commands, applying schema management, running the health verification, and restarting application plus database to confirm persistence — delivers a proven persistence foundation.

**Acceptance Scenarios**:

1. **Given** no local database exists, **When** the documented database setup command runs, **Then** a database is created and reachable by the application.
2. **Given** a brand-new empty database, **When** schema management runs, **Then** it applies cleanly with zero errors and zero manual steps.
3. **Given** the application running, **When** the health verification runs, **Then** it reports success and demonstrates a complete write-and-read round trip through the data layer.
4. **Given** data written by the verification, **When** the application and database are stopped and restarted, **Then** the data is still present (proving real persistence, not in-memory storage).

---

### User Story 4 - Styled, Themeable, Accessible UI Shell (Priority: P2)

The scaffold ships a minimal application shell built on the approved UI conventions: a placeholder landing view, base UI primitives ready for feature work, light and dark themes with the choice persisted across sessions, and correct rendering at desktop, tablet, and mobile widths.

**Why this priority**: Every future screen builds on the design system, theming, and layout base; proving them now prevents rework across all later features.

**Independent Test**: Can be fully tested by opening the placeholder page, toggling themes, resizing across the three width classes, and navigating by keyboard — delivers a proven, styled, accessible starting point for all feature UIs.

**Acceptance Scenarios**:

1. **Given** the application open in a browser, **When** the placeholder page is viewed, **Then** it renders with the approved design conventions and no visual defects.
2. **Given** the page viewed at mobile, tablet, and desktop widths, **When** the layout is inspected, **Then** content renders correctly at each width with no horizontal scrolling.
3. **Given** the light theme active, **When** the user switches to dark, **Then** the interface updates immediately and the choice persists across a full browser restart.
4. **Given** keyboard-only interaction, **When** the user tabs through the shell, **Then** focus is visible and every interactive element is reachable and operable.

---

### Edge Cases

- What happens when a required environment setting is missing or invalid? The application MUST fail fast at startup with an actionable message naming the item — never an internal stack trace.
- How does the system behave when the local database is not running? Data-layer commands and the health verification MUST report a clear "database unreachable" message with a remediation hint (how to start it), not a raw internal error.
- What happens when the application's local port is already in use? The startup failure MUST be understandable and its remedy documented in the README.
- What happens on the very first end-to-end test run on a new machine? Any one-time browser automation runtime installation MUST be handled by a documented command, not discovered by failure.
- What happens when the local database is deleted and recreated? Schema management MUST apply from zero with no manual repair steps.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The foundation MUST provide a locally runnable web application that starts with one documented command from a fresh clone, after documented one-time prerequisite installation.
- **FR-002**: The foundation MUST wire the approved technology stack exactly as listed under Constraints below; no additional runtime libraries MAY be introduced without documented justification approved in review.
- **FR-003**: TypeScript MUST run in strict mode; the type-checking command MUST pass with zero errors on the untouched scaffold.
- **FR-004**: Linting and formatting MUST be configured and enforceable via documented commands; both MUST pass on the untouched scaffold.
- **FR-005**: Unit and component test infrastructure MUST run via one documented command and MUST include at least one passing sample test per layer (a pure logic test and a rendered-component test) proving each level of the harness works.
- **FR-006**: Browser end-to-end test infrastructure MUST run via one documented command against the locally running application and MUST include at least one passing smoke test (application loads; primary shell visible).
- **FR-007**: The local database MUST start via a documented command, MUST persist data across restarts, and MUST require no manual schema setup.
- **FR-008**: Schema management MUST apply to a brand-new empty database with a single documented command, zero manual steps, and zero errors.
- **FR-009**: The application MUST provide a health verification (reachable during development) that proves database connectivity and a complete write-and-read round trip through the data layer.

- **FR-010**: The application shell MUST support light and dark themes, persist the chosen theme across sessions, and default to the system preference on first visit.
- **FR-011**: The application shell MUST provide accessible base UI primitives per the approved design conventions (semantic structure, keyboard operability, visible focus) ready for feature development.
- **FR-012**: All environment-specific configuration MUST be documented via a committed example environment file; real secrets MUST NOT be committed; required configuration MUST be validated at startup with actionable error messages.
- **FR-013**: The README MUST enable a new developer to reach a running environment by following only its steps, documenting purpose, prerequisites, setup, environment variables, database commands, all quality-check and test commands, and a project-structure orientation.
- **FR-014**: The untouched scaffold MUST pass all quality gates (FR-003, FR-004, FR-005, FR-006) and MUST contain no debug logging statements and no unnecessary TODO placeholders.
- **FR-015**: The placeholder landing view MUST render correctly at mobile, tablet, and desktop widths without horizontal scrolling.

### Constraints *(user-mandated)*

The following are treated as requirements — not implementation choices — because this feature's deliverable IS the technology foundation, as explicitly requested in the feature description:

- Next.js 16 with App Router as the application framework
- TypeScript in strict mode
- Tailwind CSS with shadcn/ui design conventions for the UI foundation
- Server Actions as the primary mutation path (route handlers only where appropriate)
- Prisma as the data layer; PostgreSQL as the local database (a disposable local Docker instance)
- Vitest for unit tests; React Testing Library for component tests; Playwright for end-to-end smoke tests
- ESLint and Prettier for code quality and formatting
- Theming (light/dark) with persisted preference

### Key Entities *(include if feature involves data)*

This feature intentionally introduces NO business data entities — user accounts, tasks, and categories arrive with their own features. Infrastructure-level data only:

- **Database Baseline**: The empty, migration-managed application database; owned by this feature as the substrate on which all future entities are built. Contains no business tables of its own beyond what schema management requires.
- **Theme Preference**: A per-browser interface preference (light or dark) persisted across sessions; the only end-user-facing data in this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer meeting the documented prerequisites reaches a running application with a working database by following only the README in 15 minutes or fewer, with zero undocumented manual steps.
- **SC-002**: On a fresh clone, type checking and linting each complete in under 1 minute, the unit and component suites in under 1 minute, and the end-to-end smoke suite in under 5 minutes (steady state, excluding the documented one-time browser runtime installation) — and all pass.
- **SC-003**: 100% of commands documented in the README work verbatim as written, verified by executing each one during review.
- **SC-004**: The theme switch updates the interface immediately and survives a full browser restart in 100% of attempts.
- **SC-005**: The write-and-read health verification succeeds and its data persists across a full application and database restart in 100% of attempts.
- **SC-006**: The placeholder view shows no horizontal scrolling at 320px, 768px, and 1280px widths (representative mobile, tablet, desktop).
- **SC-007** *(qualitative)*: A developer reviewing the scaffold can identify where each future capability belongs and what every documented command does without asking anyone.

## Assumptions

Scope boundaries (explicitly out of scope for this feature):

- Authentication, user accounts, and session handling are separate later features; this foundation does not include them (Auth.js integration ships with the authentication feature).
- No business features are included: no tasks, categories, dashboard, settings, search, or filters; no business schema beyond the empty database baseline.
- No CI pipelines, hosting, deployment, or production configuration; this foundation covers local development only.
- Performance work beyond the baseline gates in SC-002 is deferred to later features.

Environment and tooling assumptions:

- Developers use current stable versions of the approved stack at implementation time and a current LTS runtime; a local Docker installation is a documented prerequisite for the disposable local PostgreSQL instance.
- The package manager and exact tool configuration are implementation decisions deferred to the planning phase; this specification constrains only the approved stack set.
- The local database is disposable: it can be deleted and recreated at any time without losing anything of value; no seed data is required.
- UI text is English; all scaffold content is placeholder, not real product copy.
- The users of the placeholder shell are the project's own developers until feature UIs arrive.


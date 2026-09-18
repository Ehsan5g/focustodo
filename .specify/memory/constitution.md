# FocusTodo Constitution

## Core Principles

### I. Server-Authoritative Security (NON-NEGOTIABLE)

The server is the only source of truth for identity and data access.

- The authenticated user MUST be derived from the server-side session; a
  userId supplied by the browser MUST NOT be accepted as a source of truth.
- Every task and category query and mutation MUST enforce ownership at the
  server boundary. A user MUST never be able to read, modify, or delete
  another user's tasks, categories, or private data.
- All server action and route handler inputs MUST be validated with Zod on
  the server, even when the client also validates.
- Passwords MUST never be stored or logged in plaintext. Password hashes and
  other sensitive authentication data MUST never be exposed to the client.
- Unsafe HTML rendering MUST be avoided; database access MUST use Prisma
  APIs correctly (parameterized queries) to prevent SQL injection.
- A task or feature that violates this principle is not complete, regardless
  of other progress.

### II. Type Safety and Strict Validation

Types are the first line of defense against runtime and security bugs.

- TypeScript strict mode is mandatory; `any` and unnecessary type assertions
  MUST NOT be used.
- Zod schemas MUST be the single source of truth for input contracts and
  MUST be shared between client and server for: registration, login, create
  task, update task, create category, update category, and task filters.
- Client-side validation is a UX convenience only; server-side validation is
  authoritative and MUST always run.
- Field constraints are contractual: title 1-120 characters; description
  optional up to 1000 characters; status TODO|IN_PROGRESS|COMPLETED;
  priority LOW|MEDIUM|HIGH; user email unique; category names unique per
  user.

### III. Modular Architecture and Simplicity

Small, well-separated modules are how this project stays maintainable.

- Use modular architecture with atomic design. Separate UI components,
  feature components, server actions, domain/business logic, database
  access, validation schemas, authentication/authorization helpers, and
  shared utilities.
- Business logic MUST NOT live inside large React components; client
  components MUST NOT access Prisma directly; server actions and route
  handlers MUST stay small and focused.
- Server Components MUST be used by default; Client Components only when
  interactivity requires them, keeping client-side JavaScript minimal.
- Database queries MUST fetch only the fields required by the UI; indexes
  MUST be evaluated against actual query patterns (Task.userId,
  Task.status, Task.priority, Task.dueDate, Task.categoryId,
  Category.userId; compound indexes as patterns demand).
- Duplicated business logic, unnecessary abstractions, and premature design
  patterns MUST be avoided (YAGNI). Added complexity MUST be justified.

### IV. Test-First Quality Gates (NON-NEGOTIABLE)

A feature is not done until its tests exist and pass.

- The project MUST contain automated tests: unit (validation schemas, task
  business rules, filtering and sorting logic, authorization logic where
  practical), component (task form, task item, filters, empty states), and
  end-to-end (registration, login, create/edit/complete/search/filter/delete
  task, logout).
- The security E2E scenario MUST exist and pass: User A MUST NOT be able to
  access User B's tasks.
- Where practical, tests are written and observed failing before the code
  that satisfies them; every bug fix starts from a failing test.
- A feature is complete only when the Definition of Done (see Development
  Workflow and Quality Gates) is fully satisfied.

### V. Production UX, Accessibility, and Performance

The product must feel professional and work for every user and device.

- Accessibility: semantic HTML, keyboard navigation, visible focus states,
  accessible labels, dialogs, forms, and buttons; form errors displayed near
  the relevant field; sufficient contrast. Task status and priority MUST NOT
  rely on color alone.
- Responsive: the application MUST work on desktop (sidebar navigation),
  tablet, and mobile (compact navigation, touch-friendly controls) without
  horizontal scrolling; task create/edit uses a modal on desktop and a
  bottom sheet on mobile.
- Optimistic updates are used only where they improve UX (completing a
  task, toggling status); on failure the UI MUST roll back, show an error,
  and stay consistent with the server.
- Loading states and success feedback MUST be visible for async operations.
- Errors (validation, authentication, authorization, database, not found,
  network, unexpected) MUST map to user-friendly messages; sensitive
  server/database details MUST never reach the client; useful diagnostics
  are logged server-side.
- Useful empty states MUST provide an appropriate next action.

## Technology and Security Constraints

The approved stack is fixed; changing it requires a constitution amendment.

- Frontend: Next.js 16 with App Router, React, TypeScript (strict mode),
  Tailwind CSS, shadcn/ui design conventions; light and dark themes with the
  theme preference persisted across sessions.
- Backend: Next.js Server Actions (Route Handlers only where appropriate),
  Prisma ORM, PostgreSQL (Docker Compose for local development).
- Authentication: Auth.js. Validation: Zod. Testing: Vitest, React Testing
  Library, Playwright. Tooling: ESLint, Prettier.
- No unnecessary libraries: prefer native Next.js and React capabilities
  when they are sufficient.
- Every server action MUST follow the five-step contract: (1) validate
  input, (2) authenticate the user, (3) authorize access, (4) execute
  business logic, (5) return a predictable result. Raw database objects
  MUST NOT be returned to the client when unnecessary.
- Data model contracts: User (id, name, unique email, passwordHash,
  createdAt, updatedAt); Task (id, userId, title, optional description,
  status, priority, optional dueDate, optional categoryId, createdAt,
  updatedAt); Category (id, userId, name unique per user, createdAt,
  updatedAt). Ownership: a User has many Tasks and Categories; a Task
  belongs to one User and optionally one Category.

## Development Workflow and Quality Gates

Spec-driven, incremental, reviewable work is mandatory.

- The Spec Kit workflow MUST be followed: understand requirements, identify
  ambiguities, resolve clarifications, produce a specification, produce a
  technical plan, break work into small tasks, implement incrementally, run
  tests/type checks/lint, review, fix issues, and update documentation. The
  entire application MUST NOT be generated in one step.
- Each implementation task MUST be small enough to review independently and
  MUST NOT modify unrelated files. Existing code MUST be inspected before
  implementing a task; afterwards, relevant tests, type checking, and
  linting run, and the diff is reviewed.
- Quality gates (all MUST pass before a task is complete): TypeScript type
  checking with no known errors; ESLint; unit, component, and E2E tests; no
  unnecessary TODO comments; no debug console statements in production
  code.
- Definition of Done for a feature: requirement implemented; server-side
  validation exists; authorization is enforced; UI states (loading, error,
  empty, success) are handled; tests exist; TypeScript passes; ESLint
  passes; no obvious security issue; documentation updated when necessary.
- A professional README MUST be maintained covering product, features, tech
  stack, architecture, project structure, environment variables, local
  development, database setup, tests, E2E tests, the AI-assisted workflow,
  and key architectural decisions.

## Governance

This constitution is the highest authority for the FocusTodo repository.

- Supersedes: all other practices, ad-hoc decisions, and convenience
  shortcuts. Conflicts resolve in favor of this document.
- Amendments: MUST be documented in a Sync Impact Report, MUST state the
  version change, and MUST include a migration plan when behavior changes.
- Versioning (semantic versioning): MAJOR for backward-incompatible
  governance changes or principle removals/redefinitions; MINOR for new
  principles/sections or materially expanded guidance; PATCH for
  clarifications and non-semantic refinements.
- Compliance review: every PR and review MUST verify compliance; complexity
  MUST be justified against Principle III.
- Runtime development guidance lives in feature plans and tasks generated
  from `.specify/templates/plan-template.md` and
  `.specify/templates/tasks-template.md`; those documents MUST comply with
  this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-09-15 | **Last Amended**: 2026-09-15
import { expect, test, type Page } from "@playwright/test";

import { Pool } from "pg";

/**
 * E2E task scenarios (F003; quickstart S1–S12). Each test registers a unique
 * per-run user via the UI and cleans up its own rows afterwards (sessions and
 * tasks cascade from the user delete).
 *
 * DB assertions go through raw SQL (`pg`): the Playwright process cannot
 * import the ESM-only generated Prisma client. Tables are snake_case;
 * columns keep the Prisma field names (quoted camelCase).
 */

const BASE_URL = "http://localhost:3000";
const runId = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

test.afterAll(async () => {
  // Tasks and sessions cascade from the user delete (onDelete: Cascade).
  await pool.query("DELETE FROM users WHERE email LIKE $1", [`%${runId}%`]);
  await pool.end();
});

async function registerAndOpenList(page: Page): Promise<string> {
  const email = `tasks-${runId}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("Tasky McTaskface");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
  return email;
}

async function openCreateSurface(page: Page) {
  await page.getByRole("button", { name: "New task" }).click();
  await expect(page.getByLabel("Title")).toBeVisible();
}

// Every DB cross-check is scoped to the test's OWN registered user (the
// returned email): other tests, other files, and stale rows from killed runs
// share the dev database — a title-only query would count them (hermetic
// isolation for parallel workers and reruns).
async function countTasks(email: string, title: string): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email = $1 AND t.title = $2',
    [email, title],
  );
  return rows[0]?.count ?? -1;
}

/** Create a task through the UI (defaults) and wait for the surface to close. */
async function createTask(page: Page, title: string) {
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByTestId("new-task-surface")).toHaveCount(0);
}

test("US1 S1: title-only create saves with defaults TODO/MEDIUM and the task appears", async ({
  page,
}) => {
  const email = await registerAndOpenList(page);
  await openCreateSurface(page);
  await page.getByLabel("Title").fill("Buy milk");
  await page.getByRole("button", { name: "Create task" }).click();

  // The surface closes on success (SC-001). The task's visible appearance in
  // the list is completed with US2's list in T017; the persisted row is
  // asserted directly below.
  await expect(page.getByTestId("new-task-surface")).toHaveCount(0);

  const { rows } = await pool.query<{
    status: string;
    priority: string;
    description: string | null;
    dueDate: string | null;
  }>(
    'SELECT t.status, t.priority, t.description, t."dueDate"::text AS "dueDate" FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email = $1 AND t.title = $2',
    [email, "Buy milk"],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("TODO");
  expect(rows[0].priority).toBe("MEDIUM");
  expect(rows[0].description).toBeNull();
  expect(rows[0].dueDate).toBeNull();
});

test("US1 S2: all-fields create (incl. initial status) saves every value exactly", async ({
  page,
}) => {
  const email = await registerAndOpenList(page);
  await openCreateSurface(page);
  await page.getByLabel("Title").fill("Plan sprint");
  await page
    .getByLabel("Description")
    .fill("Draft the sprint goals and capacity");
  await page.getByLabel("Due date").fill("2030-06-15");
  await page.getByLabel("Priority").selectOption("HIGH");
  await page.getByLabel("Status").selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Create task" }).click();

  await expect(page.getByTestId("new-task-surface")).toHaveCount(0);
  const { rows } = await pool.query<{
    status: string;
    priority: string;
    description: string;
    dueDate: string;
  }>(
    'SELECT t.status, t.priority, t.description, t."dueDate"::text AS "dueDate" FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email = $1 AND t.title = $2',
    [email, "Plan sprint"],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("IN_PROGRESS");
  expect(rows[0].priority).toBe("HIGH");
  expect(rows[0].description).toBe("Draft the sprint goals and capacity");
  expect(rows[0].dueDate).toBe("2030-06-15");
});

test("US1 S3: invalid submissions show field-level errors and create nothing", async ({
  page,
}) => {
  const email = await registerAndOpenList(page);
  await openCreateSurface(page);

  // Empty title.
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(
    page.getByText("Title is required", { exact: false }).first(),
  ).toBeVisible();

  // Over-long title (the malformed-date rejection is pinned at the schema
  // level in tests/unit/task-schema.test.ts — a native date input cannot
  // hold an impossible value to submit).
  await page.getByLabel("Title").fill("x".repeat(121));
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(
    page.getByText(/Title must be at most 120 characters/),
  ).toBeVisible();

  expect(await countTasks(email, "x".repeat(121))).toBe(0);
});

test("US1 S11: rapid double-click submit creates at most one task (scripted clicks, D12)", async ({
  page,
}) => {
  const email = await registerAndOpenList(page);
  await openCreateSurface(page);
  await page.getByLabel("Title").fill("Only once");
  const submit = page.getByRole("button", { name: "Create task" });
  // Scripted rapid clicks — never timing sleeps (D12). Three synchronous DOM
  // clicks race the in-flight submission: the pending-gated submit button
  // (D8) must make #2 and #3 no-ops, so at most one task is created.
  await submit.evaluate((element) => {
    if (!(element instanceof HTMLButtonElement)) return;
    element.click();
    element.click();
    element.click();
  });

  await expect(page.getByTestId("new-task-surface")).toHaveCount(0);
  expect(await countTasks(email, "Only once")).toBe(1);
});

test("US2 S5: a fresh account sees the empty state with a create-first-task action", async ({
  page,
}) => {
  await registerAndOpenList(page);
  await expect(page.getByText(/create your first task/i).first()).toBeVisible();
});

test("US2: creates appear newest-first and persist across a reload (S1 deferred ≤2 s assertion)", async ({
  page,
}) => {
  await registerAndOpenList(page);
  const titles = ["Alpha first", "Beta second", "Gamma third"];
  for (const title of titles) {
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByTestId("new-task-surface")).toHaveCount(0);
  }

  // Newest-first order (T012's deferred ~2 s assertion — the created task is
  // in the rendered list).
  const first = page.getByText("Gamma third");
  await expect(first).toBeVisible();
  const older = page.getByText("Alpha first");
  expect((await first.boundingBox())!.y < (await older.boundingBox())!.y).toBe(
    true,
  );

  // Persist across a reload (SC-002).
  await page.reload();
  await expect(page.getByText("Alpha first")).toBeVisible();
  await expect(page.getByText("Gamma third")).toBeVisible();
});

test("US2 S4/SC-007: the list stays readable with color disabled", async ({
  page,
}) => {
  await registerAndOpenList(page);
  await page.emulateMedia({ forcedColors: "active" });
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Monochrome readable");
  await page.getByLabel("Due date").fill("2026-09-01");
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByTestId("new-task-surface")).toHaveCount(0);

  await expect(page.getByText("Monochrome readable")).toBeVisible();
  await expect(page.getByText(/To do/).first()).toBeVisible();
  await expect(page.getByText(/Medium priority/i).first()).toBeVisible();
  // Past due + open → the OVERDUE flag is text, readable without color.
  await expect(page.getByText(/Overdue/).first()).toBeVisible();
  await page.emulateMedia({ forcedColors: "none" });
});

test("US2 S4/SC-003/FR-004: two-user privacy — User B sees none of User A's tasks", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  const emailA = await registerAndOpenList(pageA);
  for (const title of ["Alice secret", "Alice another"]) {
    await pageA.getByRole("button", { name: "New task" }).click();
    await pageA.getByLabel("Title").fill(title);
    await pageA.getByRole("button", { name: "Create task" }).click();
    await expect(pageA.getByTestId("new-task-surface")).toHaveCount(0);
  }
  await expect(pageA.getByText("Alice secret")).toBeVisible();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  const emailB = await registerAndOpenList(pageB);
  await expect(pageB.getByText(/create your first task/i)).toBeVisible();
  await expect(pageB.getByText("Alice secret")).toHaveCount(0);
  await expect(pageB.getByText("Alice another")).toHaveCount(0);
  // B creates their own task; the two lists stay fully independent.
  await createTask(pageB, "Bobbys own task");
  await expect(pageB.getByText("Bobbys own task")).toBeVisible();
  await expect(pageB.getByText("Alice secret")).toHaveCount(0);

  // DB-level cross-check: A owns exactly her two rows and B exactly his one
  // (UI isolation above proved the read scoping; this proves the rows
  // themselves are per-user — scoped to the two registered accounts so other
  // tests' or stale rows cannot leak into the count).
  const owners = await pool.query(
    'SELECT u.email, COUNT(*)::int AS tasks FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email IN ($1, $2) GROUP BY u.email',
    [emailA, emailB],
  );
  const byEmail = new Map(
    owners.rows.map((row) => [row.email as string, row.tasks as number]),
  );
  expect(byEmail.get(emailA)).toBe(2);
  expect(byEmail.get(emailB)).toBe(1);

  await contextA.close();
  await contextB.close();
});

test("US3 S1: complete a TODO task directly — instant flip, persisted (forward skip)", async ({
  page,
}) => {
  const email = await registerAndOpenList(page);
  await createTask(page, "Toggle me");
  await page.getByRole("button", { name: "Complete" }).click();

  // The label flips to the target state without a reload (optimistic, D3).
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();

  // The write is confirmed server-side (polled — never a timing sleep).
  await expect
    .poll(async () => {
      const { rows } = await pool.query<{ status: string }>(
        'SELECT t.status FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email = $1 AND t.title = $2',
        [email, "Toggle me"],
      );
      return rows[0]?.status;
    })
    .toBe("COMPLETED");
});

test("US3 S6/FR-008: reopen a COMPLETED task resets it to TODO", async ({
  page,
}) => {
  const email = await registerAndOpenList(page);
  await createTask(page, "Reopen me");
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
  // Wait for the server state (polled, not a sleep) so the Reopen click is
  // issued against the settled COMPLETED state.
  await expect
    .poll(async () => {
      const { rows } = await pool.query<{ status: string }>(
        'SELECT t.status FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email = $1 AND t.title = $2',
        [email, "Reopen me"],
      );
      return rows[0]?.status;
    })
    .toBe("COMPLETED");
  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(page.getByRole("button", { name: "Complete" })).toBeVisible();

  await expect
    .poll(async () => {
      const { rows } = await pool.query<{ status: string }>(
        'SELECT t.status FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email = $1 AND t.title = $2',
        [email, "Reopen me"],
      );
      return rows[0]?.status;
    })
    .toBe("TODO");
});

test("US3: rapid toggling settles consistent (scripted clicks, D12)", async ({
  page,
}) => {
  const email = await registerAndOpenList(page);
  await createTask(page, "Rapid toggle");
  await page.getByRole("button", { name: "Complete" }).click();
  await page.getByRole("button", { name: "Reopen" }).click();
  await page.getByRole("button", { name: "Complete" }).click();
  await page.getByRole("button", { name: "Reopen" }).click();

  await expect(page.getByRole("button", { name: "Complete" })).toBeVisible();
  await expect
    .poll(async () => {
      const { rows } = await pool.query<{ status: string }>(
        'SELECT t.status FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email = $1 AND t.title = $2',
        [email, "Rapid toggle"],
      );
      return rows[0]?.status;
    })
    .toBe("TODO");
});

test("US3 S7/SC-004: a failed toggle rolls back the UI with an understandable error and a reload matches the server (request interception, D12)", async ({
  page,
}) => {
  const email = await registerAndOpenList(page);
  await createTask(page, "Rollback target");
  // D12 request interception: fail the NEXT server-action POST (Next.js
  // server actions ride POST / with a Next-Action header — never task
  // content in the URL). The task's toggle write is the next mutation.
  let intercepted = false;
  await page.route("**/", async (route) => {
    const request = route.request();
    if (
      !intercepted &&
      request.method() === "POST" &&
      request.headerValue("Next-Action") !== null
    ) {
      intercepted = true;
      await route.fulfill({ status: 500, body: "intercepted" });
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Complete" }).click();

  // The optimistic flip rolls back and a friendly error shows.
  await expect(
    page.getByText(/Something went wrong|no longer exists|try again/i).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete" })).toBeVisible();

  // A reload matches the server state: still TODO.
  await page.unrouteAll();
  await page.reload();
  await expect(page.getByRole("button", { name: "Complete" })).toBeVisible();
  await expect
    .poll(async () => {
      const { rows } = await pool.query<{ status: string }>(
        'SELECT t.status FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email = $1 AND t.title = $2',
        [email, "Rollback target"],
      );
      return rows[0]?.status;
    })
    .toBe("TODO");
});
// __US4_EDIT__

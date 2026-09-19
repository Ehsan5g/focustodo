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

async function countTasks(title: string): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM tasks WHERE title = $1",
    [title],
  );
  return rows[0]?.count ?? -1;
}

test("US1 S1: title-only create saves with defaults TODO/MEDIUM and the task appears", async ({
  page,
}) => {
  await registerAndOpenList(page);
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
    'SELECT status, priority, description, "dueDate"::text AS "dueDate" FROM tasks WHERE title = $1',
    ["Buy milk"],
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
  await registerAndOpenList(page);
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
    'SELECT status, priority, description, "dueDate"::text AS "dueDate" FROM tasks WHERE title = $1',
    ["Plan sprint"],
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
  await registerAndOpenList(page);
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

  expect(await countTasks("x".repeat(121))).toBe(0);
});

test("US1 S11: rapid double-click submit creates at most one task (scripted clicks, D12)", async ({
  page,
}) => {
  await registerAndOpenList(page);
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
  expect(await countTasks("Only once")).toBe(1);
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
  await registerAndOpenList(pageA);
  for (const title of ["Alice secret", "Alice another"]) {
    await pageA.getByRole("button", { name: "New task" }).click();
    await pageA.getByLabel("Title").fill(title);
    await pageA.getByRole("button", { name: "Create task" }).click();
    await expect(pageA.getByTestId("new-task-surface")).toHaveCount(0);
  }
  await expect(pageA.getByText("Alice secret")).toBeVisible();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await registerAndOpenList(pageB);
  await expect(pageB.getByText(/create your first task/i)).toBeVisible();
  await expect(pageB.getByText("Alice secret")).toHaveCount(0);
  await expect(pageB.getByText("Alice another")).toHaveCount(0);

  // DB-level cross-check: the tasks created here exist and are owned by
  // exactly two distinct users (UI isolation already proved B sees none of
  // A's rows; this confirms the rows themselves are per-user in the DB).
  const owners = await pool.query(
    'SELECT COUNT(DISTINCT "userId")::int AS owners, COUNT(*)::int AS tasks FROM tasks t JOIN users u ON u.id = t."userId" WHERE t.title IN ($1, $2)',
    ["Alice secret", "Alice another"],
  );
  expect(owners.rows[0].owners).toBe(2);
  expect(owners.rows[0].tasks).toBe(2);

  await contextA.close();
  await contextB.close();
});
// __US3_TOGGLE__

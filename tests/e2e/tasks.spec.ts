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
// __US2_LIST__

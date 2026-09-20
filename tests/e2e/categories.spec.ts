import { expect, test, type Page } from "@playwright/test";

import { Pool } from "pg";

/**
 * E2E category scenarios (F004; quickstart S1–S15). Each test registers a
 * unique per-run user via the UI and cleans up its own rows afterwards
 * (categories and tasks cascade from the user delete).
 *
 * DB assertions go through raw SQL (`pg`): the Playwright process cannot
 * import the ESM-only generated Prisma client. Tables are snake_case;
 * columns keep the Prisma field names (quoted camelCase).
 */

const BASE_URL = "http://localhost:3000";
const runId = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

test.afterAll(async () => {
  // Categories and tasks cascade from the user delete (onDelete: Cascade).
  await pool.query("DELETE FROM users WHERE email LIKE $1", [`%${runId}%`]);
  await pool.end();
});

async function registerUser(page: Page): Promise<string> {
  const email = `cats-${runId}-${Math.random()
    .toString(36)
    .slice(2, 8)}@test.local`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("Category McCategoryface");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
  return email;
}

/** Reach the category management page through the protected navigation. */
async function openCategories(page: Page) {
  await page.getByRole("link", { name: "Categories" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/categories`);
}

async function openCreateSurface(page: Page) {
  await page.getByTestId("new-category-button").click();
  await expect(page.getByLabel("Category name")).toBeVisible();
}

/** Create a category through the UI and wait for the surface to close. */
async function createCategoryViaUi(page: Page, name: string) {
  await openCreateSurface(page);
  await page.getByLabel("Category name").fill(name);
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByTestId("new-category-surface")).toHaveCount(0);
}

// Every DB cross-check is scoped to the test's OWN registered user (hermetic
// isolation — see tasks.spec.ts).
async function countCategories(
  email: string,
  nameKey: string,
): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM categories c JOIN users u ON u.id = c."userId" WHERE u.email = $1 AND c."nameKey" = $2',
    [email, nameKey],
  );
  return rows[0]?.count ?? -1;
}

test("US1 S1: create “Work” → appears in the alphabetical category list (SC-001)", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Work");

  await expect(page.getByTestId("category-list")).toBeVisible();
  await expect(page.getByTestId("category-item")).toHaveText(["Work"]);
  expect(await countCategories(email, "work")).toBe(1);
});

test("US1 S2: “work” while “Work” exists is rejected near the field with no second row", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Work");

  await openCreateSurface(page);
  await page.getByLabel("Category name").fill("work");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(
    page.getByText("You already have a category with this name."),
  ).toBeVisible();
  // The surface stays open with the inline error; dismiss without mutating.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("new-category-surface")).toHaveCount(0);
  await expect(page.getByTestId("category-item")).toHaveCount(1);
  expect(await countCategories(email, "work")).toBe(1);
});

test("US1 S3: spaces-only name → inline required error, nothing created", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await openCreateSurface(page);
  await page.getByLabel("Category name").fill("   ");
  await expect(page.getByText("Category name is required")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("new-category-surface")).toHaveCount(0);
  await expect(page.getByTestId("category-empty-state")).toBeVisible();
  expect(await countCategories(email, "")).toBe(0);
});

test("US1 S4: a 60-character name is accepted; 61 characters is rejected", async ({
  page,
}) => {
  const email = await registerUser(page);
  const longName = "Long category name ".padEnd(60, "x");
  await openCategories(page);
  await createCategoryViaUi(page, longName);
  await expect(page.getByTestId("category-item")).toHaveText([longName]);
  expect(await countCategories(email, longName.toLowerCase())).toBe(1);

  await openCreateSurface(page);
  await page.getByLabel("Category name").fill(`${longName}y`);
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(
    page.getByText("Category name must be at most 60 characters"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("new-category-surface")).toHaveCount(0);
  await expect(page.getByTestId("category-item")).toHaveCount(1);
});

test("US1 S12: the first visit shows the empty state with its next action", async ({
  page,
}) => {
  await registerUser(page);
  await openCategories(page);
  await expect(page.getByTestId("category-empty-state")).toBeVisible();
  await page.getByTestId("empty-state-create-category").click();
  await expect(page.getByLabel("Category name")).toBeVisible();
});

// ——— F004 US2 (T017): per-task category assignment ———

/** A's category id (ownership-scoped, nameKey-normalized — never by name alone). */
async function findCategoryId(
  email: string,
  nameKey: string,
): Promise<string | undefined> {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT c.id FROM categories c JOIN users u ON u.id = c."userId" WHERE u.email = $1 AND c."nameKey" = $2',
    [email, nameKey],
  );
  return rows[0]?.id;
}

/**
 * The stored FK for one of the test's own tasks. The "missing" sentinel keeps
 * `expect.poll` retrying until the row exists (optimistic UI, D3) — but a
 * PRESENT row's NULL is a real cleared link (S6), never the sentinel.
 */
async function taskCategoryId(
  email: string,
  title: string,
): Promise<string | null> {
  const { rows } = await pool.query<{ categoryId: string | null }>(
    'SELECT t."categoryId"::text AS "categoryId" FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email = $1 AND t.title = $2',
    [email, title],
  );
  if (rows.length === 0) return "missing";
  return rows[0]!.categoryId;
}

async function openTaskCreateSurface(page: Page) {
  await page.getByRole("button", { name: "New task" }).click();
  await expect(page.getByLabel("Title")).toBeVisible();
}

test("US2 S5: creating a task with a category persists the link and shows the badge", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Work");
  const categoryId = await findCategoryId(email, "work");
  expect(categoryId).toBeTruthy();

  await page.goto(`${BASE_URL}/`);
  await openTaskCreateSurface(page);
  await page.getByLabel("Title").fill("Buy milk");
  await page.getByLabel("Category").selectOption({ label: "Work" });
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByTestId("new-task-surface")).toHaveCount(0);

  // The stored row carries the owner's category id (polled — never a sleep).
  await expect
    .poll(async () => taskCategoryId(email, "Buy milk"))
    .toBe(categoryId);

  // The server-rendered list joins the category name (reload settles the
  // optimistic insert; the badge is the joined name, not the raw id).
  await page.reload();
  await expect(page.getByTestId("category-badge")).toHaveText("Work");
});

test("US2 S5: assigning a category on edit persists it and pre-fills on reopen", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Personal");
  const categoryId = await findCategoryId(email, "personal");
  expect(categoryId).toBeTruthy();

  await page.goto(`${BASE_URL}/`);
  await openTaskCreateSurface(page);
  await page.getByLabel("Title").fill("Errand");
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByTestId("new-task-surface")).toHaveCount(0);

  await page.getByTestId("edit-task").click();
  const surface = page.getByTestId("edit-task-surface");
  await expect(surface).toBeVisible();
  // The picker starts on "No category" — the task has no link yet.
  await expect(page.getByLabel("Category")).toHaveValue("");
  await page.getByLabel("Category").selectOption({ label: "Personal" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(surface).toHaveCount(0);

  await expect
    .poll(async () => taskCategoryId(email, "Errand"))
    .toBe(categoryId);

  // Reopening the edit surface pre-fills the stored link (update UX).
  await page.getByTestId("edit-task").click();
  await expect(page.getByLabel("Category")).toHaveValue(categoryId!);
  await page.keyboard.press("Escape");
  await expect(surface).toHaveCount(0);
});

test("US2 S6: switching to “No category” clears the link (badge disappears)", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Temp");
  const categoryId = await findCategoryId(email, "temp");
  expect(categoryId).toBeTruthy();

  await page.goto(`${BASE_URL}/`);
  await openTaskCreateSurface(page);
  await page.getByLabel("Title").fill("Tagged");
  await page.getByLabel("Category").selectOption({ label: "Temp" });
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByTestId("new-task-surface")).toHaveCount(0);
  await expect
    .poll(async () => taskCategoryId(email, "Tagged"))
    .toBe(categoryId);

  await page.getByTestId("edit-task").click();
  const surface = page.getByTestId("edit-task-surface");
  await expect(surface).toBeVisible();
  await page.getByLabel("Category").selectOption({ label: "No category" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(surface).toHaveCount(0);

  // The empty option parses to a real NULL — the link is gone, not "".
  await expect.poll(async () => taskCategoryId(email, "Tagged")).toBe(null);

  await page.reload();
  await expect(page.getByTestId("category-badge")).toHaveCount(0);
});

test("US2 S7/SC-003: B's picker never offers A's category and a forged submit is rejected", async ({
  page,
  browser,
}) => {
  // User A creates the category that B will try to steal.
  const emailA = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Work");
  const foreignCategoryId = await findCategoryId(emailA, "work");
  expect(foreignCategoryId).toBeTruthy();

  // User B in a fully isolated browser context (independent session cookie).
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  const emailB = await registerUser(pageB);
  await openCategories(pageB);
  await createCategoryViaUi(pageB, "Bobs own");
  await pageB.goto(`${BASE_URL}/`);
  await openTaskCreateSurface(pageB);
  await pageB.getByLabel("Title").fill("Bobs task");
  await pageB.getByRole("button", { name: "Create task" }).click();
  await expect(pageB.getByTestId("new-task-surface")).toHaveCount(0);

  // The picker offers only B's own categories — A's id is never an option.
  await pageB.getByTestId("edit-task").click();
  const surface = pageB.getByTestId("edit-task-surface");
  await expect(surface).toBeVisible();
  const optionValues = await pageB
    .getByLabel("Category")
    .evaluate((element) =>
      Array.from((element as HTMLSelectElement).options).map(
        (option) => option.value,
      ),
    );
  expect(optionValues).not.toContain(foreignCategoryId);

  // Force-submit the forged id anyway — the real threat is a hand-built
  // request, not the rendered options.
  await pageB.getByLabel("Category").evaluate((element, foreignId) => {
    const select = element as HTMLSelectElement;
    const forged = document.createElement("option");
    forged.value = foreignId;
    select.append(forged);
    select.value = foreignId;
  }, foreignCategoryId!);
  await pageB.getByRole("button", { name: "Save changes" }).click();

  // Friendly failure; the surface stays open with the message (D9 contract).
  await expect(surface).toBeVisible();
  await expect(pageB.getByText(/no longer available/i)).toBeVisible();

  // Nothing was written: B's task still has no category link.
  await expect
    .poll(async () => {
      const { rows } = await pool.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM tasks t JOIN users u ON u.id = t."userId" WHERE u.email = $1 AND t.title = $2 AND t."categoryId" = $3',
        [emailB, "Bobs task", foreignCategoryId],
      );
      return rows[0]?.count ?? -1;
    })
    .toBe(0);

  await contextB.close();
});

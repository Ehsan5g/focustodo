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

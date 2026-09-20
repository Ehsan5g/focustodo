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
  // exact: true — row buttons carry aria-labels like "Rename <name>"; a
  // non-exact label lookup would substring-match a category NAMED
  // "…category name…" (US1 S4 learned this the hard way).
  await expect(page.getByLabel("Category name", { exact: true })).toBeVisible();
}

/** Create a category through the UI and wait for the surface to close. */
async function createCategoryViaUi(page: Page, name: string) {
  await openCreateSurface(page);
  await page.getByLabel("Category name", { exact: true }).fill(name);
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
  await expect(page.getByTestId("category-name")).toHaveText(["Work"]);
  expect(await countCategories(email, "work")).toBe(1);
});

test("US1 S2: “work” while “Work” exists is rejected near the field with no second row", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Work");

  await openCreateSurface(page);
  await page.getByLabel("Category name", { exact: true }).fill("work");
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
  await page.getByLabel("Category name", { exact: true }).fill("   ");
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
  await expect(page.getByTestId("category-name")).toHaveText([longName]);
  expect(await countCategories(email, longName.toLowerCase())).toBe(1);

  await openCreateSurface(page);
  await page.getByLabel("Category name", { exact: true }).fill(`${longName}y`);
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
  await expect(page.getByLabel("Category name", { exact: true })).toBeVisible();
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

// ——— F004 US3 (T023): rename propagation, near-field rejection, no-op ———

/** Open a row's rename surface via its per-row control (exact-name scoped). */
async function openRenameSurface(page: Page, currentName: string) {
  await page
    .getByTestId("category-item")
    .filter({ has: page.getByText(currentName, { exact: true }) })
    .getByTestId("rename-category")
    .click();
  const surface = page.getByTestId("rename-category-surface");
  await expect(surface).toBeVisible();
  return surface;
}

/** Create a task through the UI, optionally assigned to a category label. */
async function createTaskViaUi(
  page: Page,
  title: string,
  categoryLabel?: string,
) {
  await openTaskCreateSurface(page);
  await page.getByLabel("Title").fill(title);
  if (categoryLabel) {
    await page.getByLabel("Category").selectOption({ label: categoryLabel });
  }
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByTestId("new-task-surface")).toHaveCount(0);
}

test("US3 S8/SC-005: renaming “Work” → “Deep Work” propagates to the list, the picker, and every task label", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Work");
  const categoryId = await findCategoryId(email, "work");
  expect(categoryId).toBeTruthy();

  await page.goto(`${BASE_URL}/`);
  await createTaskViaUi(page, "Alpha", "Work");
  await createTaskViaUi(page, "Beta", "Work");
  await createTaskViaUi(page, "Gamma", "Work");
  await expect(page.getByTestId("category-badge")).toHaveText([
    "Work",
    "Work",
    "Work",
  ]);

  await openCategories(page);
  const surface = await openRenameSurface(page, "Work");
  // The rename surface opens PRE-FILLED with the current name.
  await expect(page.getByLabel("Category name")).toHaveValue("Work");
  await page.getByLabel("Category name").fill("Deep Work");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(surface).toHaveCount(0);

  // The management list shows the new name…
  await expect(page.getByTestId("category-name")).toHaveText(["Deep Work"]);
  // …the DB row carries the new nameKey, still exactly one row…
  expect(await countCategories(email, "deep work")).toBe(1);
  expect(await countCategories(email, "work")).toBe(0);
  // …every assigned task label shows the NEW name (reference, not a copy)…
  await page.goto(`${BASE_URL}/`);
  await expect(page.getByTestId("category-badge")).toHaveText([
    "Deep Work",
    "Deep Work",
    "Deep Work",
  ]);
  // …and the picker offers the new label under the UNCHANGED id.
  await page.getByTestId("edit-task").first().click();
  await expect(page.getByTestId("edit-task-surface")).toBeVisible();
  const picker = page.getByLabel("Category");
  await expect(picker).toHaveValue(categoryId!);
  const optionLabels = await picker.evaluate((element) =>
    Array.from((element as HTMLSelectElement).options).map(
      (option) => option.label,
    ),
  );
  expect(optionLabels).toContain("Deep Work");
});

test("US3 S9: renaming to a case-insensitive duplicate is rejected near the field", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Work");
  await createCategoryViaUi(page, "Deep Work");

  const surface = await openRenameSurface(page, "Work");
  await page.getByLabel("Category name").fill("deep work");
  await page.getByRole("button", { name: "Save changes" }).click();

  // Inline near the field; the surface stays open; the old name remains.
  await expect(
    page.getByText("You already have a category with this name."),
  ).toBeVisible();
  await expect(surface).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(surface).toHaveCount(0);
  await expect(page.getByTestId("category-name")).toHaveText([
    "Deep Work",
    "Work",
  ]);
  expect(await countCategories(email, "work")).toBe(1);
  expect(await countCategories(email, "deep work")).toBe(1);
});

test("US3 S9: a 61-character rename is rejected and the old name remains", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Short");

  const surface = await openRenameSurface(page, "Short");
  await page.getByLabel("Category name").fill("x".repeat(61));
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(
    page.getByText("Category name must be at most 60 characters"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(surface).toHaveCount(0);
  await expect(page.getByTestId("category-name")).toHaveText(["Short"]);
  expect(await countCategories(email, "short")).toBe(1);
  expect(await countCategories(email, "x".repeat(61))).toBe(0);
});

test("US3 D8: renaming to the identical name is a no-op success", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Stable");

  const surface = await openRenameSurface(page, "Stable");
  await page.getByLabel("Category name", { exact: true }).fill("Stable");
  await page.getByRole("button", { name: "Save changes" }).click();

  // Success closes the surface; the name is unchanged; still one row.
  await expect(surface).toHaveCount(0);
  await expect(page.getByTestId("category-name")).toHaveText(["Stable"]);
  expect(await countCategories(email, "stable")).toBe(1);
});

test("US3 S14: a task edit saved after a rename in another tab shows the CURRENT name", async ({
  page,
  context,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Work");

  await page.goto(`${BASE_URL}/`);
  await createTaskViaUi(page, "Sync target", "Work");

  // Open the edit surface BEFORE the rename — its picker snapshot is stale.
  await page.getByTestId("edit-task").click();
  const editSurface = page.getByTestId("edit-task-surface");
  await expect(editSurface).toBeVisible();

  // Another tab of the SAME session renames the category.
  const pageB = await context.newPage();
  await pageB.goto(`${BASE_URL}/categories`);
  const surfaceB = await openRenameSurface(pageB, "Work");
  await pageB.getByLabel("Category name", { exact: true }).fill("Deep Work");
  await pageB.getByRole("button", { name: "Save changes" }).click();
  await expect(surfaceB).toHaveCount(0);

  // Saving in the first tab stores the UNCHANGED id; the fresh join shows
  // the CURRENT name — never an outdated label.
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(editSurface).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("category-badge")).toHaveText("Deep Work");
  const renamedId = await findCategoryId(email, "deep work");
  await expect
    .poll(async () => taskCategoryId(email, "Sync target"))
    .toBe(renamedId);
});

// ——— F004 US4 (T029): delete confirmation, SetNull reassignment, stale tab ———

/** Open a row's delete confirmation via its per-row control (exact-name scoped). */
async function openDeleteSurface(page: Page, currentName: string) {
  await page
    .getByTestId("category-item")
    .filter({ has: page.getByText(currentName, { exact: true }) })
    .getByTestId("delete-category")
    .click();
  const surface = page.getByTestId("delete-category-surface");
  await expect(surface).toBeVisible();
  return surface;
}

test("US4 S11/SC-004: confirming the delete removes the category from the list AND the picker while its tasks stay, uncategorized", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Work");
  // "Home" survives the delete so the category picker still exists to be
  // asserted against (with zero categories the picker shows an empty state).
  await createCategoryViaUi(page, "Home");
  const categoryId = await findCategoryId(email, "work");
  expect(categoryId).toBeTruthy();

  await page.goto(`${BASE_URL}/`);
  await createTaskViaUi(page, "Report", "Work");
  await createTaskViaUi(page, "Invoice", "Work");
  await expect(page.getByTestId("category-badge")).toHaveText(["Work", "Work"]);

  await openCategories(page);
  const surface = await openDeleteSurface(page, "Work");
  // The confirmation copy states the reassignment outcome (FR-010, US4.1).
  await expect(page.getByText(/not deleted/i)).toBeVisible();
  await page.getByRole("button", { name: "Delete category" }).click();
  await expect(surface).toHaveCount(0);
  // "Work" is gone from the list; "Home" remains.
  await expect(page.getByTestId("category-name")).toHaveText(["Home"]);
  expect(await countCategories(email, "work")).toBe(0);

  // Gone from the picker (which still exists — "Home" is left)…
  await page.goto(`${BASE_URL}/`);
  await page.getByTestId("edit-task").first().click();
  await expect(page.getByTestId("edit-task-surface")).toBeVisible();
  const picker = page.getByLabel("Category", { exact: true });
  const pickerValues = await picker.evaluate((element) =>
    Array.from((element as HTMLSelectElement).options).map(
      (option) => option.value,
    ),
  );
  expect(pickerValues).not.toContain(categoryId);

  // …and BOTH tasks are intact with NO category link (SetNull — D2: the
  // deletion touches only links, never task rows).
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("edit-task-surface")).toHaveCount(0);
  await expect(page.getByTestId("category-badge")).toHaveCount(0);
  await expect(page.getByText("Report")).toBeVisible();
  await expect(page.getByText("Invoice")).toBeVisible();
  await expect.poll(async () => taskCategoryId(email, "Report")).toBe(null);
  await expect.poll(async () => taskCategoryId(email, "Invoice")).toBe(null);
});

test("US4 S10: cancelling the confirmation leaves the category and its assignments untouched", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Keep me");
  const categoryId = await findCategoryId(email, "keep me");
  expect(categoryId).toBeTruthy();

  await page.goto(`${BASE_URL}/`);
  await createTaskViaUi(page, "Anchored", "Keep me");
  await expect
    .poll(async () => taskCategoryId(email, "Anchored"))
    .toBe(categoryId);

  await openCategories(page);
  const surface = await openDeleteSurface(page, "Keep me");
  await page.getByTestId("delete-category-cancel").click();
  await expect(surface).toHaveCount(0);
  await expect(page.getByTestId("category-name")).toHaveText(["Keep me"]);
  expect(await countCategories(email, "keep me")).toBe(1);
  // The assignment still points at the same, never-deleted category id.
  await expect
    .poll(async () => taskCategoryId(email, "Anchored"))
    .toBe(categoryId);
});

test("US4 S13: a stale delete of an already-deleted category shows friendly feedback and the list recovers", async ({
  page,
}) => {
  const email = await registerUser(page);
  await openCategories(page);
  await createCategoryViaUi(page, "Vanishing");
  // Wait for the creation revalidation to settle so the row we remove really
  // is only "stale-render stale", not still in flight.
  await expect(page.getByText("Vanishing")).toBeVisible();

  // Simulate the other tab deleting the row out from under this stale
  // render: remove it directly in the database (F003's stale-delete trick).
  const { rows } = await pool.query<{ id: string }>(
    'SELECT c.id FROM categories c JOIN users u ON u.id = c."userId" WHERE u.email = $1',
    [email],
  );
  expect(rows).toHaveLength(1);
  await pool.query("DELETE FROM categories WHERE id = $1", [rows[0]!.id]);

  // The page still shows the category (stale render); delete it there.
  const surface = await openDeleteSurface(page, "Vanishing");
  await page.getByRole("button", { name: "Delete category" }).click();

  // Friendly feedback, no crash. Per the D9/D12 contract the dialog stays
  // open with the message inside; the user dismisses it themselves.
  await expect(
    page.getByText(/no longer exists|refresh to see/i),
  ).toBeVisible();
  await expect(surface).toBeVisible();
  await page.getByTestId("delete-category-cancel").click();
  await expect(surface).toHaveCount(0);

  // The list recovers: a reload reflects the server state (row is gone).
  await page.reload();
  await expect(page.getByText("Vanishing")).toHaveCount(0);
  await expect(page.getByTestId("category-empty-state")).toBeVisible();
});

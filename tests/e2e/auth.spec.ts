import { expect, test, type Page } from "@playwright/test";

import { Pool } from "pg";

/**
 * E2E registration scenarios (F002 T017; quickstart S1–S3 + edge cases).
 * Fixed dev `AUTH_SECRET` per D12. Each test uses a unique per-run email and
 * cleans up its own rows — sessions cascade from the user delete.
 *
 * DB assertions go through raw SQL (`pg`, already a transitive dependency of
 * @prisma/adapter-pg): the Playwright process cannot import the ESM-only
 * generated Prisma client. Tables are snake_case (`users`, `sessions`,
 * `@@map` per the `user_auth_snake_case` migration); columns keep the
 * Prisma field names (camelCase, quoted).
 */

const BASE_URL = "http://localhost:3000";
const runId = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

test.afterAll(async () => {
  // Sessions cascade from the user delete (schema onDelete: Cascade).
  await pool.query("DELETE FROM users WHERE email LIKE $1", [`%${runId}%`]);
  await pool.end();
});

async function countUsers(email: string): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM users WHERE email = $1",
    [email],
  );
  return rows[0]?.count ?? -1;
}

async function registerViaUi(
  page: Page,
  user: { name: string; email: string; password: string },
) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("valid registration stores a scrypt hash (never plaintext), sets the session cookie, creates the first Session, and lands on /", async ({
  page,
}) => {
  const email = `reg-${runId}@test.local`;
  await registerViaUi(page, {
    name: "Ada Lovelace",
    email,
    password: "correct horse battery",
  });

  await expect(page).toHaveURL(`${BASE_URL}/`);

  const { rows } = await pool.query<{ passwordHash: string }>(
    'SELECT "passwordHash" FROM users WHERE email = $1',
    [email],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].passwordHash.startsWith("scrypt$")).toBe(true);
  expect(rows[0].passwordHash).not.toContain("correct horse battery");

  const sessions = await pool.query(
    'SELECT s.id FROM sessions s JOIN users u ON u.id = s."userId" WHERE u.email = $1',
    [email],
  );
  expect(sessions.rows).toHaveLength(1);

  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name.includes("session-token"))).toBe(
    true,
  );
});

test("duplicate email (case/whitespace variant) shows an inline email error and creates exactly one account", async ({
  page,
}) => {
  const mixedCase = `DUP-${runId}@TEST.local`;
  const variant = `  Dup-${runId}@Test.Local  `;

  await registerViaUi(page, {
    name: "John Doe",
    email: mixedCase,
    password: "password123",
  });
  await expect(page).toHaveURL(`${BASE_URL}/`);

  // Become anonymous again, then retry the same address as a variant.
  await page.context().clearCookies();
  await registerViaUi(page, {
    name: "John Again",
    email: variant,
    password: "password123",
  });

  await expect(
    page.getByText("This email is already registered. Try signing in instead."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);

  expect(await countUsers(variant.trim().toLowerCase())).toBe(1);
  expect(await countUsers(variant)).toBe(0);
});

test("invalid submissions show per-field errors and save nothing", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Please enter your name")).toBeVisible();
  await expect(
    page.getByText("Please enter a valid email address"),
  ).toBeVisible();
  await expect(
    page.getByText("Password must be at least 8 characters"),
  ).toBeVisible();

  const shortPasswordEmail = `short-${runId}@test.local`;
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill(shortPasswordEmail);
  await page.getByLabel("Password").fill("short12"); // 7 characters
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText("Password must be at least 8 characters"),
  ).toBeVisible();

  const oversizedEmail = `${"x".repeat(251)}@test.local`; // 262 chars
  await page.getByLabel("Email").fill(oversizedEmail);
  await page.getByLabel("Password").fill("longenough1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText("Email must be at most 254 characters"),
  ).toBeVisible();

  await expect(page).toHaveURL(/\/register$/);
  const invalidTotal =
    (await countUsers(shortPasswordEmail)) + (await countUsers(oversizedEmail));
  expect(invalidTotal).toBe(0);
});

test("double submit creates at most one account", async ({ page }) => {
  const email = `race-${runId}@test.local`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("Speedy Clicker");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");

  // Fire both submits synchronously in one JS tick — the second click lands
  // while the button is pending/disabled (or re-validates against the row
  // just created), so at most ONE account can result either way.
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (!button) throw new Error("submit button not found");
    button.click();
    button.click();
  });

  // Either race outcome is correct (FR-015): the pending-disabled button
  // blocks the second submit (→ redirect to /), or the second submission
  // loses the duplicate-email check (→ inline email error, stays on
  // /register). The invariant under BOTH: exactly one account.
  await expect
    .poll(
      () =>
        page.url() === `${BASE_URL}/` ||
        page
          .getByText(
            "This email is already registered. Try signing in instead.",
          )
          .isVisible(),
      { timeout: 15_000 },
    )
    .toBe(true);

  if (new URL(page.url()).pathname === "/register") {
    await expect(
      page.getByText(
        "This email is already registered. Try signing in instead.",
      ),
    ).toBeVisible();
  }
  expect(await countUsers(email)).toBe(1);
});

test("sign-in with correct credentials reaches the protected area", async ({
  page,
}) => {
  const email = `signin-${runId}@test.local`;
  await registerViaUi(page, {
    name: "Signy McSignface",
    email,
    password: "password123",
  });
  await expect(page).toHaveURL(`${BASE_URL}/`);

  // Become anonymous, then sign in through the sign-in view.
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(`${BASE_URL}/`);
  await expect(page.getByText("Signy McSignface")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("wrong password and unknown email show the SAME generic rejection", async ({
  page,
}) => {
  const email = `wrongpw-${runId}@test.local`;
  await registerViaUi(page, {
    name: "Wrong Password",
    email,
    password: "password123",
  });
  await expect(page).toHaveURL(`${BASE_URL}/`);
  await page.context().clearCookies();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();

  // Unknown email: identical message — no account enumeration (FR-005).
  await page.getByLabel("Email").fill(`nobody-${runId}@nowhere.test`);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign out returns to the sign-in view and revokes the session server-side", async ({
  page,
}) => {
  const email = `signout-${runId}@test.local`;
  await registerViaUi(page, {
    name: "Outy McOutface",
    email,
    password: "password123",
  });
  await expect(page).toHaveURL(`${BASE_URL}/`);

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name.includes("session-token"))).toBe(
    false,
  );

  const sessions = await pool.query(
    'SELECT s.id FROM sessions s JOIN users u ON u.id = s."userId" WHERE u.email = $1',
    [email],
  );
  expect(sessions.rows).toHaveLength(0);
});

test("signed-out direct open of / redirects to /sign-in?next=%2F with zero protected-content exposure", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/");

  await expect(page).toHaveURL(`${BASE_URL}/sign-in?next=%2F`);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByText("Foundation is running")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add a task" })).toHaveCount(0);
});

test("sign-in via the protection redirect returns the user to the original destination", async ({
  page,
}) => {
  const email = `return-${runId}@test.local`;
  await registerViaUi(page, {
    name: "Returny McReturnface",
    email,
    password: "password123",
  });
  await page.context().clearCookies();

  await page.goto("/"); // → /sign-in?next=%2F
  await expect(page).toHaveURL(`${BASE_URL}/sign-in?next=%2F`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(`${BASE_URL}/`);
  await expect(page.getByText("Returny McReturnface")).toBeVisible();
});

test("crafted external next is honored AS-IS (accepted open-redirect posture, clarified FR-008)", async ({
  page,
}) => {
  const email = `external-${runId}@test.local`;
  await registerViaUi(page, {
    name: "Externy McExternface",
    email,
    password: "password123",
  });
  await page.context().clearCookies();

  await page.goto("/sign-in?next=https%3A%2F%2Fevil.example.test%2Fphish");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/evil\.example\.test/);
});

test("signed-in users are bounced from /sign-in and /register to the protected area", async ({
  page,
}) => {
  const email = `bounce-${runId}@test.local`;
  await registerViaUi(page, {
    name: "Bouncy McBounceface",
    email,
    password: "password123",
  });
  await expect(page).toHaveURL(`${BASE_URL}/`);

  await page.goto("/sign-in");
  await expect(page).toHaveURL(`${BASE_URL}/`);

  await page.goto("/register");
  await expect(page).toHaveURL(`${BASE_URL}/`);
});

test("browser Back after sign-out serves no protected content", async ({
  page,
}) => {
  const email = `backbtn-${runId}@test.local`;
  await registerViaUi(page, {
    name: "Backy McBackface",
    email,
    password: "password123",
  });
  await expect(page).toHaveURL(`${BASE_URL}/`);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.goBack();
  // The authoritative guard re-runs on the back navigation — bounced back to
  // the sign-in view, zero protected content from cache/history (S7).
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("button", { name: "Add a task" })).toHaveCount(0);
});

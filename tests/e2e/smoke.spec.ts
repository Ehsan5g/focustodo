import { expect, test } from "@playwright/test";

// F002 US3 made "/" a protected route (T028/T031): the F001 placeholder
// smoke tests now assert the protected-home behavior — anonymous visitors
// are redirected to the sign-in view with the destination preserved.
test("home is protected: anonymous visitors are redirected to sign-in", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in\?next=%2F$/);
});

test("skip link is first tabbable element on the sign-in view", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
});

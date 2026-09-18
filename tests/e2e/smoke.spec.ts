import { expect, test } from "@playwright/test";

test("home renders the placeholder shell with landmarks", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByText("FocusTodo").first()).toBeVisible();
});

test("skip link is first tabbable element", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
});

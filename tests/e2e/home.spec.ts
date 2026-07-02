import { test, expect } from "@playwright/test";

test("has title or content", async ({ page }) => {
  await page.goto("/");

  // Verify that the page loads properly (status 200/visible elements)
  // We can just check for any text or basic structure since it's an example test
  await expect(page.locator("body")).toBeVisible();
});

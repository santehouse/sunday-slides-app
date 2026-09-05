import { test, expect } from "@playwright/test";
import { loginPin, openFlowFromDashboard } from "./helpers";

test("Add Slide creates a slide and opens its editor", async ({ page }) => {
  await loginPin(page);
  await openFlowFromDashboard(page);

  await page.getByRole("link", { name: /^add slide$/i }).click();
  await expect(page).toHaveURL(/\/add$/);

  const grid = page.getByRole("button", { name: /^use /i });
  await expect(grid.first()).toBeVisible();
  await grid.first().click();

  await expect(page).toHaveURL(/\/slide\/[^/]+/, { timeout: 10_000 });
});

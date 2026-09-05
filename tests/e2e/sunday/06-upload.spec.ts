import { test, expect } from "@playwright/test";
import { loginPin } from "./helpers";

test("Upload Run Sheet page renders the manual upload and preview panels", async ({ page }) => {
  await loginPin(page);
  await page.getByRole("link", { name: /open flow/i }).click();
  await expect(page).toHaveURL(/\/flow$/);

  await page.getByRole("link", { name: /upload run sheet/i }).click();
  await expect(page).toHaveURL(/\/upload$/);

  await expect(page.getByRole("heading", { name: "Manual upload" })).toBeVisible();
  await expect(page.getByText("Drop Word or PDF run sheet here")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run sheet preview" })).toBeVisible();
  await expect(page.getByText("Upload a file to preview the detected announcements.")).toBeVisible();
});

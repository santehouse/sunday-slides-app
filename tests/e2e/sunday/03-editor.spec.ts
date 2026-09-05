import { test, expect } from "@playwright/test";
import { loginPin, openFlowFromDashboard } from "./helpers";

test("Slide Editor shows a text-fit message and saves changes", async ({ page }) => {
  await loginPin(page);
  await openFlowFromDashboard(page);

  await page.locator("[data-slide-card] [data-slide-select]").first().dblclick();
  await expect(page).toHaveURL(/\/slide\/[^/]+/);

  // The live text-fit MessageState renders once the client canvas measurer resolves.
  await expect(page.getByText(/text fit looks good|text needs attention|text does not fit/i)).toBeVisible({
    timeout: 10_000,
  });

  const headlineInput = page.getByLabel(/^Headline/);
  await headlineInput.fill("UPDATED HEADLINE");

  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Slide saved")).toBeVisible();
});

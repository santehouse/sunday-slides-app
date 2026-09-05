import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers";

test.describe("Template library and studio", () => {
  test("grid shows 8+ cards and filters by category", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/templates");
    await expect(page.getByRole("heading", { name: "Template library" })).toBeVisible();

    const cards = page.locator("a[href^='/admin/templates/']");
    await expect(cards).not.toHaveCount(0);
    const totalCount = await cards.count();
    expect(totalCount).toBeGreaterThanOrEqual(8);

    await page.getByRole("button", { name: "Events", exact: true }).click();
    await expect(page.getByText("Baptisms", { exact: true })).toBeVisible();
    const filteredCount = await cards.count();
    expect(filteredCount).toBeLessThan(totalCount);
  });

  test("edits a field and saves in the Studio", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/templates/tmpl-welcome");

    const labelInput = page.getByLabel("Label (EN)");
    await expect(labelInput).toBeVisible();
    await labelInput.fill("Headline updated");

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Template saved")).toBeVisible();
  });
});

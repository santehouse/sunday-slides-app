import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers";

test.describe("Announcement mappings", () => {
  test("dialog creates a mapping", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/mappings");
    await expect(page.getByRole("heading", { name: "Announcement mappings" })).toBeVisible();

    await page.getByRole("button", { name: "Add mapping" }).click();
    await page.getByLabel("Canonical announcement").fill("Youth group night");
    await page.getByLabel("Template").selectOption({ index: 0 });
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Mapping saved")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Youth group night" })).toBeVisible();
  });
});

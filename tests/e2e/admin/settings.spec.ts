import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers";

test.describe("Settings", () => {
  test("updates the Sunday PIN", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await page.getByLabel("Sunday PIN").fill("24681");
    await page.getByRole("button", { name: "Update PIN" }).click();

    await expect(page.getByText("Sunday PIN updated")).toBeVisible();
  });
});

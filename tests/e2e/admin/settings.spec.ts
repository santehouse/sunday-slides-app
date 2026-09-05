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

    // The mock store is shared by every spec in this dev-server process: restore the demo PIN
    // so the Sunday suite (which signs in with 53787) keeps working when the suites run together.
    await page.getByLabel("Sunday PIN").fill("53787");
    await page.getByRole("button", { name: "Update PIN" }).click();
    await expect(page.getByText("Sunday PIN updated").last()).toBeVisible();
  });
});

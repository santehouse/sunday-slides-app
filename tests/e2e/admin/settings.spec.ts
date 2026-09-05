import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers";

const DEMO_PIN = "53787";

test.describe("Settings", () => {
  test("updates the Sunday PIN and the change takes effect for the Sunday team", async ({ page, context }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await page.getByLabel("Sunday PIN").fill("24681");
    await page.getByRole("button", { name: "Update PIN" }).click();
    await expect(page.getByText("Sunday PIN updated")).toHaveCount(1);

    // The old PIN no longer signs anyone in...
    const sunday = await context.newPage();
    await sunday.goto("/sunday/pin");
    const digits = sunday.locator('input[inputmode="numeric"]');
    for (let i = 0; i < DEMO_PIN.length; i++) await digits.nth(i).fill(DEMO_PIN[i]!);
    await sunday.getByRole("button", { name: /open sunday/i }).click();
    await expect(sunday).toHaveURL(/\/sunday\/pin$/);
    await expect(sunday.getByText("That PIN isn’t right. Try again.")).toBeVisible();

    // ...and a session cookie minted before the rotation is rejected too (pinVersion bump).
    for (let i = 0; i < 5; i++) await digits.nth(i).fill("24681"[i]!);
    await sunday.getByRole("button", { name: /open sunday/i }).click();
    await sunday.waitForURL(/\/sunday\/\d{4}-\d{2}-\d{2}$/);

    // The mock store is shared by every spec in this dev-server process: restore the demo
    // PIN, and assert the restore really landed (a stale PIN breaks the whole Sunday suite).
    await page.getByLabel("Sunday PIN").fill(DEMO_PIN);
    await page.getByRole("button", { name: "Update PIN" }).click();
    await expect(page.getByText("Sunday PIN updated")).toHaveCount(2);

    // The still-open Sunday tab's cookie was signed against the previous pinVersion.
    await sunday.reload();
    await expect(sunday).toHaveURL(/\/sunday\/pin$/);
    await sunday.close();

    const restored = await context.newPage();
    await restored.goto("/sunday/pin");
    const restoredDigits = restored.locator('input[inputmode="numeric"]');
    for (let i = 0; i < DEMO_PIN.length; i++) await restoredDigits.nth(i).fill(DEMO_PIN[i]!);
    await restored.getByRole("button", { name: /open sunday/i }).click();
    await restored.waitForURL(/\/sunday\/\d{4}-\d{2}-\d{2}$/);
    await restored.close();
  });
});

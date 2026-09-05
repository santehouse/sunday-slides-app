import { test, expect } from "@playwright/test";
import { DEMO_SUNDAY_DATE, loginPin, openFlowFromDashboard } from "./helpers";

test.describe("PIN access", () => {
  test("a valid PIN reaches the Sunday dashboard", async ({ page }) => {
    await loginPin(page);
    await expect(page).toHaveURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Scoped to the header: Next's route announcer also carries the brand now that
    // document titles are "<page> · Church Panels".
    await expect(page.getByRole("banner").getByText("Church Panels")).toBeVisible();
  });

  test("an invalid PIN shows an error and stays on the PIN page", async ({ page }) => {
    await page.goto("/sunday/pin");
    const inputs = page.locator('input[inputmode="numeric"]');
    const wrongPin = "11111";
    for (let i = 0; i < wrongPin.length; i++) {
      await inputs.nth(i).fill(wrongPin[i]!);
    }
    await page.getByRole("button", { name: /open sunday/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/sunday\/pin$/);
  });
});

test.describe("French locale", () => {
  test("shows Eglise Panels and the French Sunday Flow title", async ({ page }) => {
    await loginPin(page, { locale: "fr" });
    await expect(page.getByRole("banner").getByText("Eglise Panels")).toBeVisible();

    await openFlowFromDashboard(page);
    await expect(page).toHaveURL(/\/fr\/sunday\/\d{4}-\d{2}-\d{2}\/flow\?/);
    await expect(page.getByRole("heading", { name: "Déroulement du dimanche" })).toBeVisible();
  });
});

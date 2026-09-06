import { test, expect } from "@playwright/test";
import { DEMO_SUNDAY_DATE, loginPin } from "./helpers";

/** Old Sunday routes keep working as redirects into the simplified 3-step IA. */

test.describe("old routes redirect", () => {
  test("/flow -> the Sunday date, preserving ?slide=", async ({ page }) => {
    await loginPin(page);
    const slideId = await page.locator("[data-slide-card]").first().getAttribute("id");
    const id = slideId?.replace("slide-card-", "") ?? "";

    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/flow?slide=${id}`);
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}\\?slide=${id}$`));

    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/flow`);
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}$`));
  });

  test("/upload -> /run-sheet", async ({ page }) => {
    await loginPin(page);
    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/upload`);
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}/run-sheet$`));
  });

  test("/add -> ?add=1", async ({ page }) => {
    await loginPin(page);
    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/add`);
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}\\?add=1$`));
    await expect(page.getByRole("heading", { name: "Add a slide" })).toBeVisible();
  });

  test("/slide/[slideId] -> ?slide=<id>", async ({ page }) => {
    await loginPin(page);
    const slideId = await page.locator("[data-slide-card]").first().getAttribute("id");
    const id = slideId?.replace("slide-card-", "") ?? "";

    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/slide/${id}`);
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}\\?slide=${id}$`));
  });
});

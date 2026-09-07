import { test, expect } from "@playwright/test";
import { DEMO_SUNDAY_DATE, loginPin } from "./helpers";

/** Every old per-date Sunday route collapses into the single `/sunday` queue screen. */

test.describe("old routes redirect", () => {
  test("/sunday/[date] -> /sunday, preserving ?slide=", async ({ page }) => {
    await loginPin(page);
    const slideId = await page.locator("[data-slide-card]").first().getAttribute("id");
    const id = slideId?.replace("slide-card-", "") ?? "";

    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}?slide=${id}`);
    await page.waitForURL(new RegExp(`/sunday\\?slide=${id}$`));

    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}`);
    await page.waitForURL(/\/sunday$/);
  });

  test("/flow -> /sunday, preserving ?slide=", async ({ page }) => {
    await loginPin(page);
    const slideId = await page.locator("[data-slide-card]").first().getAttribute("id");
    const id = slideId?.replace("slide-card-", "") ?? "";

    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/flow?slide=${id}`);
    await page.waitForURL(new RegExp(`/sunday\\?slide=${id}$`));

    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/flow`);
    await page.waitForURL(/\/sunday$/);
  });

  test("/upload and /run-sheet -> /sunday?import=1", async ({ page }) => {
    await loginPin(page);
    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/upload`);
    await page.waitForURL(/\/sunday\?import=1$/);

    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/run-sheet`);
    await page.waitForURL(/\/sunday\?import=1$/);

    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/run-sheet/previous`);
    await page.waitForURL(/\/sunday\?import=1$/);
  });

  test("/add -> /sunday?add=1", async ({ page }) => {
    await loginPin(page);
    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/add`);
    await page.waitForURL(/\/sunday\?add=1$/);
    await expect(page.getByRole("heading", { name: "Add a slide" })).toBeVisible();
  });

  test("/download -> /sunday", async ({ page }) => {
    await loginPin(page);
    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/download`);
    await page.waitForURL(/\/sunday$/);
  });

  test("/slide/[slideId] -> /sunday?slide=<id>, opening the Edit modal", async ({ page }) => {
    await loginPin(page);
    const slideId = await page.locator("[data-slide-card]").first().getAttribute("id");
    const id = slideId?.replace("slide-card-", "") ?? "";

    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/slide/${id}`);
    await page.waitForURL(new RegExp(`/sunday\\?slide=${id}$`));
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

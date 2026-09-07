import { test, expect } from "@playwright/test";
import { loginPin } from "./helpers";

/**
 * The single Sunday screen (`/sunday`): the queue of slides for the current service
 * (the demo deck, 2026-09-06, is the mock `getNextSunday` fallback — see helpers.ts),
 * with a review strip above it for anything that needs a look.
 */

test.describe("queue screen", () => {
  test("renders all 8 demo slides with the review strip", async ({ page }) => {
    await loginPin(page);
    await expect(page).toHaveURL(/\/sunday$/);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This service’s panels");
    // No date under the title: the queue is one running service, not a dated deck.
    await expect(page.getByText("Sunday, September 6")).toHaveCount(0);

    await expect(page.locator("[data-slide-card]")).toHaveCount(8);

    // One seeded needs_review slide ("Veillée des hommes") surfaces in the review strip.
    const strip = page.getByRole("alert").filter({ hasText: "needs a look" });
    await expect(strip).toBeVisible();
    const item = strip.getByRole("button", { name: /veillée des hommes/i });
    await expect(item).toContainText("The computer wasn’t sure which design to use");

    // A small "Check" tag also shows on that row itself.
    const row = page.locator("[data-slide-card]").filter({ hasText: /veillée des hommes/i });
    await expect(row.getByText("Check", { exact: true })).toBeVisible();

    // Clicking the review-strip item opens the Edit modal for that slide.
    await item.click();
    const dialog = page.getByRole("dialog").filter({ hasText: /veillée des hommes/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the film toggle shows the current in-video state for every row", async ({ page }) => {
    await loginPin(page);
    const first = page.locator("[data-slide-card]").first();
    const film = first.getByRole("button", { name: /shown in the video|not shown in the video/i });
    await expect(film).toHaveAttribute("aria-pressed");
  });

  test("clicking a row body selects it and updates the preview panel; editing opens a modal instead", async ({ page }) => {
    await loginPin(page);
    const row = page.locator("[data-slide-card]").filter({ hasText: /baptêmes/i });
    await row.locator("[data-slide-select]").click();
    await expect(row).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog").filter({ hasText: /baptêmes/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("FR: title, review strip and tags are translated", async ({ page }) => {
    await loginPin(page, { locale: "fr" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Panneaux de ce culte");
    await expect(page.getByRole("alert").filter({ hasText: "a besoin d’un coup d’œil" })).toBeVisible();
    await expect(page.locator("[data-slide-card]").filter({ hasText: /veillée des hommes/i }).getByText("À vérifier", { exact: true })).toBeVisible();
  });
});

test.describe("action row", () => {
  test("Import announcements and New slide are always available above the queue", async ({ page }) => {
    await loginPin(page);
    await expect(page.getByRole("button", { name: "Import announcements" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New slide" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear queue" })).toBeVisible();
  });
});

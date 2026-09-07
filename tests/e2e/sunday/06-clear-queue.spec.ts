import { test, expect } from "@playwright/test";
import { loginPin } from "./helpers";

/**
 * "Clear queue" — two-step confirm, then the empty state. Runs last in this directory
 * (alphabetically, in Playwright's single-worker suite) and restores the demo deck
 * afterward by re-using the Sunday's already-received run sheet, so a re-run of the
 * suite (or anything reading this Sunday afterward) still sees the seeded 8 slides.
 */

test("clearing the queue needs two confirms, then shows the empty state; using the received file restores it", async ({ page }) => {
  test.setTimeout(60_000);
  await loginPin(page);
  await expect(page.locator("[data-slide-card]")).not.toHaveCount(0);

  await page.getByRole("button", { name: "Clear queue" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Clear the queue?");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toContainText("Really clear everything?");
  // Still showing slides — the first confirm only advanced to the final step.
  await expect(page.locator("[data-slide-card]")).not.toHaveCount(0);

  await dialog.getByRole("button", { name: "Yes, clear the queue" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Queue cleared")).toBeVisible();

  // "Always" structural slides (Welcome, See you next week) are never removable, so
  // they're all that's left — not a fully empty queue.
  await expect(page.locator("[data-slide-card]")).toHaveCount(2);
  await expect(page.locator("[data-slide-card]").filter({ hasText: /bienvenue/i })).toBeVisible();
  await expect(page.locator("[data-slide-card]").filter({ hasText: /à la semaine prochaine/i })).toBeVisible();

  // Restore the demo deck from the Sunday's own already-received run sheet.
  await page.getByRole("button", { name: "Import announcements" }).click();
  const row = page.locator("li").filter({ hasText: "260906.docx" }).first();
  await row.getByRole("button", { name: "Use this file" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
  await page.locator("[data-slide-card]").first().waitFor();
  // The real run sheet yields 8 announcements plus the 4 structural slides.
  await expect(page.locator("[data-slide-card]")).toHaveCount(12);
});

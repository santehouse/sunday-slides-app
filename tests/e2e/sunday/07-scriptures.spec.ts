import { test, expect } from "@playwright/test";
import { loginPin } from "./helpers";

/**
 * The Scriptures deck: its own view behind the section toggle, fed by the bundled
 * Louis Segond 1910. Announcement slides are untouched by anything done here.
 */
test("scriptures are a separate deck: verse picker adds slides, JPG-only download, announcements untouched", async ({ page }) => {
  test.setTimeout(60_000);
  await loginPin(page);
  await expect(page.locator("[data-slide-card]")).not.toHaveCount(0);
  const announcementCount = await page.locator("[data-slide-card]").count();

  // Flip to Scriptures: empty, with its own call to action.
  await page.getByRole("radio", { name: "Scriptures" }).click();
  await expect(page).toHaveURL(/section=scriptures/);
  await expect(page.getByText("No scripture slides yet. Add a passage or a slide.")).toBeVisible();
  await expect(page.locator("[data-slide-card]")).toHaveCount(0);

  // Pick Hébreux 10:38-39, one verse per slide.
  await page.getByRole("button", { name: "Add scripture" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Book").selectOption("HEB");
  await dialog.getByLabel("Chapter").selectOption("10");
  await expect(dialog.getByText("Et mon juste vivra par la foi", { exact: false })).toBeVisible();
  await dialog.getByRole("checkbox").nth(37).check();
  await dialog.getByRole("checkbox").nth(38).check();
  await expect(dialog.getByText("Hébreux 10:38-39 · 2 slides")).toBeVisible();
  await dialog.getByRole("button", { name: "Add 2 slides" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(page.locator("[data-slide-card]")).toHaveCount(2);
  await expect(page.getByText("Hébreux 10:38").first()).toBeVisible();
  await expect(page.getByText("Hébreux 10:39").first()).toBeVisible();

  // Scripture downloads are pictures only.
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("button", { name: /Download panels/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Download video/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Back to announcements: the same deck as before, nothing added or lost.
  await page.getByRole("radio", { name: "Announcements" }).click();
  await expect(page).not.toHaveURL(/section=scriptures/);
  await expect(page.locator("[data-slide-card]")).toHaveCount(announcementCount);
  await expect(page.getByText("Hébreux 10:38")).toHaveCount(0);

  // Clean up the shared mock store: clear the scripture deck, announcements stay.
  await page.getByRole("radio", { name: "Scriptures" }).click();
  await expect(page.locator("[data-slide-card]")).toHaveCount(2);
  await page.getByRole("button", { name: "Clear queue" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, clear the queue" }).click();
  await expect(page.locator("[data-slide-card]")).toHaveCount(0);
  await page.getByRole("radio", { name: "Announcements" }).click();
  await expect(page.locator("[data-slide-card]")).toHaveCount(announcementCount);
});

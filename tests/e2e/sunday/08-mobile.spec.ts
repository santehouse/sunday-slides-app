import { test, expect } from "@playwright/test";
import { loginPin } from "./helpers";

/**
 * Phone-sized guard for the two flows a volunteer does from a pew: create a slide and add
 * a scripture. Runs at an iPhone-13-ish viewport with touch; the page must never scroll
 * sideways and the dialog footers must stay reachable.
 */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page must not scroll sideways").toBeLessThanOrEqual(0);
}

test("on a phone, a volunteer can create a slide and add a scripture", async ({ page }) => {
  test.setTimeout(90_000);
  await loginPin(page);
  await expect(page.locator("[data-slide-card]")).not.toHaveCount(0);
  const before = await page.locator("[data-slide-card]").count();
  await expectNoHorizontalScroll(page);

  // New slide: pick the first layout, the form appears with its Save button on screen.
  await page.getByRole("button", { name: "New slide" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Use / }).first().click();
  const save = dialog.getByRole("button", { name: "Save" });
  await expect(save).toBeVisible();
  await expect(save).toBeInViewport();
  await save.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-slide-card]")).toHaveCount(before + 1);
  await expectNoHorizontalScroll(page);

  // Scriptures: the picker's list and its Add button both stay reachable.
  await page.getByRole("radio", { name: "Scriptures" }).click();
  await page.getByRole("button", { name: "Add scripture" }).first().click();
  const picker = page.getByRole("dialog");
  await picker.getByLabel("Book").selectOption("HEB");
  await picker.getByLabel("Chapter").selectOption("10");
  await expect(picker.getByText("Et mon juste vivra par la foi", { exact: false })).toBeVisible();
  await picker.getByRole("checkbox").nth(37).check();
  const add = picker.getByRole("button", { name: "Add 1 slide" });
  await expect(add).toBeInViewport();
  await add.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-slide-card]")).toHaveCount(1);
  await expectNoHorizontalScroll(page);

  // Clean up the shared mock store: remove the scripture slide and the created slide.
  await page.getByRole("button", { name: "Clear queue" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, clear the queue" }).click();
  await expect(page.locator("[data-slide-card]")).toHaveCount(0);
  await page.getByRole("radio", { name: "Announcements" }).click();
  await expect(page.locator("[data-slide-card]")).toHaveCount(before + 1);
  await page.locator("[data-slide-card]").last().getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, remove slide" }).click();
  await expect(page.locator("[data-slide-card]")).toHaveCount(before);
});

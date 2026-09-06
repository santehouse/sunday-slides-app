import { test, expect } from "@playwright/test";
import { DEMO_SUNDAY_DATE, gotoCheckSlides, loginPin } from "./helpers";

/**
 * Step 2 ("Check slides") — the inline edit panel that replaced the old full-page
 * Slide Editor / Add Slide screens. Runs against the demo Sunday (2026-09-06); each
 * test restores whatever it changed so the deck (and its one seeded needs_review
 * slide) is back to its original shape by the time this file finishes.
 */

test("saving the needs-review slide clears it from the checklist", async ({ page }) => {
  await loginPin(page);

  await expect(page.getByRole("heading", { name: "1 thing to check" })).toBeVisible();
  await page.locator("[data-checklist-row]").filter({ hasText: /veillée des hommes/i }).getByRole("button", { name: "Check" }).click();

  await expect(page.getByRole("heading", { name: /veillée des hommes/i })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await expect(page.getByRole("heading", { name: "1 thing to check" })).toHaveCount(0);
  await expect(page.getByText("All good — your slides are ready")).toBeVisible();
});

test("add, edit, duplicate, remove (double confirm), and reorder a slide", async ({ page }) => {
  test.setTimeout(60_000);
  await loginPin(page);
  await gotoCheckSlides(page);

  const cardCount = () => page.locator("[data-slide-card]").count();
  const before = await cardCount();

  // Add a slide from the inline panel.
  await page.getByRole("button", { name: "+ Add a slide" }).click();
  await page.getByRole("button", { name: /^Use /i }).first().click();
  await expect(page.getByRole("heading", { name: "Untitled slide" })).toBeVisible({ timeout: 10_000 });
  await expect.poll(cardCount).toBe(before + 1);

  // Give it a distinctive headline so later steps can find it unambiguously.
  await page.getByLabel("Headline").fill("E2E TEST SLIDE");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E TEST SLIDE" })).toBeVisible();

  // Duplicate it.
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByText("Slide duplicated")).toBeVisible();
  await expect.poll(cardCount).toBe(before + 2);
  await expect(page.locator("[data-slide-card]").filter({ hasText: "E2E TEST SLIDE" })).toHaveCount(2);

  // Remove the duplicate — double confirm: the first click only advances to the final step.
  await page.getByRole("button", { name: "Remove this slide" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Remove this slide?");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toContainText("Really remove this slide?");
  await expect.poll(cardCount).toBe(before + 2);
  await dialog.getByRole("button", { name: "Yes, remove slide" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(cardCount).toBe(before + 1);

  // Remove the original test slide too, restoring the deck to its starting size.
  await page.locator("[data-slide-card]").filter({ hasText: "E2E TEST SLIDE" }).first().click();
  await page.getByRole("button", { name: "Remove this slide" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, remove slide" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(cardCount).toBe(before);

  // Reorder (keyboard): swap slides 1 and 2, confirm it persists, then swap back.
  // Numbers are recomputed from position after a reorder, so strip the "NN " prefix
  // before comparing — otherwise a slide that moves to a new position never matches
  // its own pre-reorder snapshot.
  async function headline(card: import("@playwright/test").Locator): Promise<string> {
    const text = await card.locator(".text-label").first().innerText();
    return text.replace(/^\d+\s*/, "");
  }
  const firstBefore = await headline(page.locator("[data-slide-card]").first());
  const secondBefore = await headline(page.locator("[data-slide-card]").nth(1));

  // Keyboard reorder via dnd-kit is timing-sensitive under load: retry the whole gesture
  // until the list reflects the swap.
  await expect(async () => {
    const handle = page.getByRole("button", { name: "Drag to reorder slide 1", exact: true });
    await handle.focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    const nowFirst = await headline(page.locator("[data-slide-card]").first());
    expect(nowFirst).toBe(secondBefore);
  }).toPass({ timeout: 15000, intervals: [500, 1000] });

  await page.reload();
  await page.locator("[data-slide-card]").first().waitFor();
  expect(await headline(page.locator("[data-slide-card]").first())).toBe(secondBefore);

  // Restore the original order for anything else that reads this Sunday's deck.
  await page.getByRole("button", { name: "Drag to reorder slide 1", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("Space");
  await expect(async () => {
    const nowFirst = await headline(page.locator("[data-slide-card]").first());
    expect(nowFirst).toBe(firstBefore);
  }).toPass({ timeout: 5000 });
});

test("stepper reflects the demo Sunday date across steps", async ({ page }) => {
  await loginPin(page);
  await gotoCheckSlides(page, DEMO_SUNDAY_DATE);
  await expect(page.getByRole("link", { name: /^Download/ })).toContainText("Ready");
});

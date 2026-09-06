import { test, expect, type Page } from "@playwright/test";
import { gotoFlow, loginPinAndWait } from "./helpers";

/**
 * BUILD_HANDOFF section 7/48 — Sunday Flow drag/keyboard reorder. The week switcher and
 * duration stepper this file used to cover were removed from the Sunday side by the
 * Simplified Sunday IA (Sept 2026) — the duration stepper now lives on Step 3
 * ("Download") and is covered by `tests/e2e/sunday/04-download.spec.ts`; there is no
 * week switcher any more (see `sunday.simple.stepper.switchTo` instead).
 */

/** Slide-flow card titles ("01 Welcome", ...) in Sunday Flow order. */
async function cardTitles(page: Page): Promise<string[]> {
  return page
    .locator("[data-slide-card]")
    .evaluateAll((cards) => cards.map((c) => c.querySelector(".text-label")?.textContent?.trim() ?? ""));
}

/** dnd-kit keyboard sorting: pick up, move, drop — with a tick between keystrokes. */
async function keyboardMove(page: Page, handleLabel: string, key: "ArrowUp" | "ArrowDown") {
  await page.getByRole("button", { name: handleLabel, exact: true }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  await page.keyboard.press(key);
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await page.waitForTimeout(700);
}

test.describe("Sunday flow", () => {
  test("selected card uses a border, not a fill, and the status pill is last in the row", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoFlow(page);

    const first = page.locator("[data-slide-card]").first();
    await expect(first, "the first card is selected by default").toHaveAttribute("aria-current", "true");

    const selectedBg = await first.evaluate((el) => getComputedStyle(el).backgroundColor);
    const unselectedBg = await page.locator("[data-slide-card]").nth(1).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(selectedBg, "selected card keeps the same surface background").toBe(unselectedBg);
    await expect(first).toHaveCSS("border-color", "rgb(79, 70, 229)");

    // The status pill is the final element in the row (Figma 6:19 / design QA checklist).
    const lastChildText = await first.evaluate((el) => el.lastElementChild?.textContent?.trim() ?? "");
    expect(lastChildText).toMatch(/^(Ready|Needs review|Text is too long)$/);
  });

  test("keyboard reorder persists and renumbers the deck", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoFlow(page);

    const before = await cardTitles(page);
    expect(before[0]).toMatch(/^01 /);

    await keyboardMove(page, "Drag to reorder slide 1", "ArrowDown");

    const after = await cardTitles(page);
    expect(after[0], "the first two slides swapped").not.toBe(before[0]);
    // Numbers are recomputed from position, so the deck still reads 01, 02, ...
    expect(after[0]).toMatch(/^01 /);
    expect(after[1]).toMatch(/^02 /);
    expect(after[1].slice(3)).toBe(before[0].slice(3));

    await page.reload();
    await page.locator("[data-slide-card]").first().waitFor();
    expect(await cardTitles(page), "the new order survives a reload").toEqual(after);

    // Move it back so later specs see the order they started from.
    await keyboardMove(page, "Drag to reorder slide 2", "ArrowUp");
    await page.reload();
    await page.locator("[data-slide-card]").first().waitFor();
    expect(await cardTitles(page)).toEqual(before);
  });

  test("pointer drag reorders the deck", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoFlow(page);
    const before = await cardTitles(page);

    const handle = page.getByRole("button", { name: "Drag to reorder slide 1", exact: true });
    const target = page.locator("[data-slide-card]").nth(2);
    const from = (await handle.boundingBox())!;
    const to = (await target.boundingBox())!;

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    const after = await cardTitles(page);
    expect(after).not.toEqual(before);
    expect(after[0]).toMatch(/^01 /);

    await page.reload();
    await page.locator("[data-slide-card]").first().waitFor();
    expect(await cardTitles(page), "drag order is persisted").toEqual(after);

    // Restore the starting order for the specs that follow.
    await keyboardMove(page, "Drag to reorder slide 3", "ArrowUp");
    await keyboardMove(page, "Drag to reorder slide 2", "ArrowUp");
    await page.reload();
    await page.locator("[data-slide-card]").first().waitFor();
    expect(await cardTitles(page)).toEqual(before);
  });
});

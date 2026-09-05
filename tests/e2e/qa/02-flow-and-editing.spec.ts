import { test, expect, type Page } from "@playwright/test";
import { DEMO_SUNDAY_DATE, gotoFlow, loginPinAndWait } from "./helpers";

/**
 * BUILD_HANDOFF sections 7/11/48 — week switcher, duration stepper, reorder,
 * and the slide editor's validation / text-fit / template-switch behaviour.
 */

/** Slide-flow card titles ("01 Welcome", ...) in Sunday Flow order. */
async function cardTitles(page: Page): Promise<string[]> {
  return page
    .locator("[data-slide-card]")
    .evaluateAll((cards) => cards.map((c) => c.querySelector(".text-label")?.textContent?.trim() ?? ""));
}

/** Lets the optimistic stepper's in-flight server actions land before a reload. */
async function settle(page: Page) {
  await page.waitForTimeout(600);
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

test.describe("Sunday dashboard controls", () => {
  test("week switcher walks to the previous and next Sunday", async ({ page }) => {
    await loginPinAndWait(page);
    await expect(page).toHaveURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}$`));

    await page.getByRole("button", { name: "Previous Sunday" }).click();
    await page.waitForURL(/\/sunday\/2026-08-30$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sunday, August 30");

    await page.getByRole("button", { name: "Next Sunday" }).click();
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sunday, September 6");
  });

  test("duration stepper clamps to 1..30 and persists across a reload", async ({ page }) => {
    await loginPinAndWait(page);

    const value = page.getByText(/^\d+ sec$/);
    const minus = page.getByRole("button", { name: "Decrease duration" });
    const plus = page.getByRole("button", { name: "Increase duration" });

    /** Clicks until the stepper reads `target`, letting each optimistic update commit. */
    async function stepTo(target: number) {
      for (let guard = 0; guard < 80; guard++) {
        const current = Number((await value.innerText()).split(" ")[0]);
        if (current === target) break;
        await (current > target ? minus : plus).click();
        await page.waitForTimeout(60);
      }
      await expect(value).toHaveText(`${target} sec`);
    }

    // Lower bound: 1 second, minus disabled.
    await stepTo(1);
    await expect(minus).toBeDisabled();
    await expect(plus).toBeEnabled();

    await settle(page);
    await page.reload();
    await expect(page.getByText(/^\d+ sec$/)).toHaveText("1 sec");

    // Upper bound: 30 seconds, plus disabled.
    await stepTo(30);
    await expect(page.getByRole("button", { name: "Increase duration" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Decrease duration" })).toBeEnabled();

    await settle(page);
    await page.reload();
    await expect(page.getByText(/^\d+ sec$/)).toHaveText("30 sec");

    // Rapid taps must not drop updates (overlapping server actions).
    for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Decrease duration" }).click();
    await expect(page.getByText(/^\d+ sec$/)).toHaveText("25 sec");
    await settle(page);
    await page.reload();
    await expect(page.getByText(/^\d+ sec$/)).toHaveText("25 sec");

    // Restore the seeded default — the mock store is shared across specs.
    await stepTo(5);
    await settle(page);
    await page.reload();
    await expect(page.getByText(/^\d+ sec$/)).toHaveText("5 sec");
  });
});

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

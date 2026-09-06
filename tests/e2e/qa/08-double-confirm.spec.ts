import { test, expect } from "@playwright/test";
import { loginPinAndWait } from "./helpers";

/**
 * Double confirmation on destructive actions (product-owner request): the Sunday
 * Flow "Remove slide" dialog must not act on its first confirm click — that click
 * only swaps the dialog into a final "really do this" step — and only the second
 * click on that final step calls the action.
 *
 * Runs entirely against 2026-08-16 (free for mutation) and never touches the demo
 * Sunday (2026-09-06) that every other spec in this suite reads slide counts from.
 */
const MUTATION_SUNDAY = "2026-08-16";

async function slideCount(page: import("@playwright/test").Page) {
  return page.locator("[data-slide-card]").count();
}

test.describe("Double confirm — Remove slide", () => {
  test("one click swaps to a final step without removing; a second click removes", async ({ page }) => {
    await loginPinAndWait(page);

    // Add a disposable slide to mutate instead of one of the seeded structural slides
    // (those refuse removal outright, which would not exercise the double-confirm step).
    await page.goto(`/sunday/${MUTATION_SUNDAY}/add`);
    await page.locator('button[aria-label^="Use "]').filter({ hasText: "General announcement" }).first().click();
    await page.waitForURL(/\/slide\//, { timeout: 30_000 });

    await page.goto(`/sunday/${MUTATION_SUNDAY}/flow`);
    await page.locator("[data-slide-card]").first().waitFor();
    const before = await slideCount(page);

    await page.locator("[data-slide-card]").last().click();
    await page.getByRole("button", { name: "Remove slide" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Remove this slide?");

    // First click: only advances to the final step. Nothing is removed yet.
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect(dialog).toContainText("Really remove this slide?");
    await expect(dialog).toContainText("This can't be undone. The slide and its content will be gone from this Sunday.");
    await expect(dialog.getByRole("button", { name: "Yes, remove slide" })).toBeVisible();
    expect(await slideCount(page), "the first confirm click must not remove the slide").toBe(before);

    // Cancelling at the final step closes the dialog without removing anything, and
    // resets the step — reopening starts back on the initial confirmation.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await slideCount(page)).toBe(before);

    await page.getByRole("button", { name: "Remove slide" }).click();
    const reopened = page.getByRole("dialog");
    await expect(reopened).toContainText("Remove this slide?");
    await expect(reopened.getByRole("button", { name: "Yes, remove slide" })).toHaveCount(0);

    // Second time through: first click advances, second click on the final step removes.
    await reopened.getByRole("button", { name: "Confirm" }).click();
    await reopened.getByRole("button", { name: "Yes, remove slide" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("[data-slide-card]")).toHaveCount(before - 1);
  });
});

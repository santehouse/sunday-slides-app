import { test, expect } from "@playwright/test";
import { loginPin, openFlowFromDashboard } from "./helpers";

test("Sunday Flow lists all 8 demo slides with Veillée des hommes needing review", async ({ page }) => {
  await loginPin(page);
  await openFlowFromDashboard(page);

  const cards = page.locator("[data-slide-card]");
  await expect(cards).toHaveCount(8);

  const reviewCard = page.locator("[data-slide-card]").filter({ hasText: /veillée des hommes/i });
  await expect(reviewCard).toBeVisible();
  await expect(reviewCard.getByText("Needs review")).toBeVisible();
});

/** Card titles render as "NN Headline" — strip the position prefix so comparisons survive a reorder. */
function headlineOnly(text: string | null): string {
  return (text ?? "").replace(/^\d+\s*/, "");
}

test("keyboard reorder moves a slide and persists after reload", async ({ page }) => {
  await loginPin(page);
  await openFlowFromDashboard(page);

  const firstHeadlineBefore = headlineOnly(await page.locator("[data-slide-card]").first().locator(".text-label").first().textContent());
  const secondHeadlineBefore = headlineOnly(await page.locator("[data-slide-card]").nth(1).locator(".text-label").first().textContent());

  const firstDragHandle = page.getByRole("button", { name: "Drag to reorder slide 1", exact: true });
  await firstDragHandle.focus();
  await page.keyboard.press("Space");
  // dnd-kit re-measures droppable rects (useLayoutEffect) after the pickup commits —
  // give that a tick before sending the move, or ArrowDown can compute a same-index delta.
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("Space");

  await expect(async () => {
    const nowFirst = headlineOnly(await page.locator("[data-slide-card]").first().locator(".text-label").first().textContent());
    expect(nowFirst).toBe(secondHeadlineBefore);
  }).toPass({ timeout: 5000 });

  await page.reload();
  const afterReloadFirst = headlineOnly(await page.locator("[data-slide-card]").first().locator(".text-label").first().textContent());
  expect(afterReloadFirst).toBe(secondHeadlineBefore);
  expect(afterReloadFirst).not.toBe(firstHeadlineBefore);
});

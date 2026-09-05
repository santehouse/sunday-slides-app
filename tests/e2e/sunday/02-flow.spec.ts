import { test, expect } from "@playwright/test";
import { loginPin } from "./helpers";

test("Sunday Flow lists all 8 demo slides with Veillée des hommes needing review", async ({ page }) => {
  await loginPin(page);
  await page.getByRole("link", { name: /open flow/i }).click();
  await expect(page).toHaveURL(/\/flow$/);

  const cards = page.getByRole("option");
  await expect(cards).toHaveCount(8);

  const reviewCard = page.getByRole("option", { name: /veillée des hommes/i });
  await expect(reviewCard).toBeVisible();
  await expect(reviewCard.getByText("Needs review")).toBeVisible();
});

/** Card titles render as "NN Headline" — strip the position prefix so comparisons survive a reorder. */
function headlineOnly(text: string | null): string {
  return (text ?? "").replace(/^\d+\s*/, "");
}

test("keyboard reorder moves a slide and persists after reload", async ({ page }) => {
  await loginPin(page);
  await page.getByRole("link", { name: /open flow/i }).click();
  await expect(page).toHaveURL(/\/flow$/);

  const firstHeadlineBefore = headlineOnly(await page.getByRole("option").first().locator("p.truncate").first().textContent());
  const secondHeadlineBefore = headlineOnly(await page.getByRole("option").nth(1).locator("p.truncate").first().textContent());

  const firstDragHandle = page.getByRole("button", { name: /drag to reorder slide 1/i });
  await firstDragHandle.focus();
  await page.keyboard.press("Space");
  // dnd-kit re-measures droppable rects (useLayoutEffect) after the pickup commits —
  // give that a tick before sending the move, or ArrowDown can compute a same-index delta.
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("Space");

  await expect(async () => {
    const nowFirst = headlineOnly(await page.getByRole("option").first().locator("p.truncate").first().textContent());
    expect(nowFirst).toBe(secondHeadlineBefore);
  }).toPass({ timeout: 5000 });

  await page.reload();
  const afterReloadFirst = headlineOnly(await page.getByRole("option").first().locator("p.truncate").first().textContent());
  expect(afterReloadFirst).toBe(secondHeadlineBefore);
  expect(afterReloadFirst).not.toBe(firstHeadlineBefore);
});

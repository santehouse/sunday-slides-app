import { test, expect } from "@playwright/test";
import { loginPin, openFlowFromDashboard } from "./helpers";

test("Export popover keeps the slide-range field and thumbnail picker in sync", async ({ page }) => {
  await loginPin(page);
  await openFlowFromDashboard(page);

  await page.getByRole("button", { name: /^export$/i }).click();
  const popover = page.getByRole("dialog");
  await popover.getByRole("radio", { name: /custom slides/i }).click();

  const rangeInput = page.getByLabel(/slide numbers/i);
  const thumb = (number: number) => popover.getByRole("button", { name: `Slide ${number}`, exact: true });

  // Thumbnails -> range field.
  for (const number of [1, 2, 3, 4, 6, 7]) {
    await thumb(number).click();
  }
  await expect(rangeInput).toHaveValue("1-4, 6-7");

  // Deselect everything, then drive the field -> thumbnails direction.
  for (const number of [1, 2, 3, 4, 6, 7]) {
    await thumb(number).click();
  }
  await rangeInput.fill("1-4, 6-7");

  for (const number of [1, 2, 3, 4, 6, 7]) {
    await expect(thumb(number)).toHaveAttribute("aria-pressed", "true");
  }
  await expect(thumb(5)).toHaveAttribute("aria-pressed", "false");
});

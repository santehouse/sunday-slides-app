import { test, expect } from "@playwright/test";
import { gotoFlow, loginPinAndWait } from "./helpers";

/**
 * These specs run against the *previous* Sunday (2026-08-30, seeded 9 slides, already
 * exported) rather than the demo Sunday: spec 04 replaces the 2026-09-06 deck from the
 * real run sheet, and a freshly parsed deck legitimately contains slides that still need
 * review, which blocks export by design.
 */
const EXPORT_SUNDAY = "2026-08-30";

/**
 * BUILD_HANDOFF sections 8/9/10/45/48 — the Export popover: format, scope, the
 * range parser's edge cases, two-way sync between the range field and the thumbnail
 * picker, and the actual JPG/MP4 downloads.
 */

async function openExport(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /^Export/ }).click();
  return page.getByRole("dialog");
}

test.describe("Export popover", () => {
  test("format and scope controls have radio semantics", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoFlow(page, EXPORT_SUNDAY);
    const popover = await openExport(page);

    const format = popover.getByRole("radiogroup", { name: "Format" });
    await expect(format.getByRole("radio", { name: "JPG" })).toHaveAttribute("aria-checked", "true");
    await expect(popover.getByRole("button", { name: "Export JPG" })).toBeVisible();

    await format.getByRole("radio", { name: "MP4" }).click();
    await expect(format.getByRole("radio", { name: "MP4" })).toHaveAttribute("aria-checked", "true");
    await expect(format.getByRole("radio", { name: "JPG" })).toHaveAttribute("aria-checked", "false");
    await expect(popover.getByRole("button", { name: "Export MP4" })).toBeVisible();

    const scope = popover.getByRole("radiogroup", { name: "Slides" });
    await expect(scope.getByRole("radio", { name: "All slides" })).toHaveAttribute("aria-checked", "true");

    // The range field and thumbnails only appear for the custom scope.
    await expect(page.getByLabel("Slide numbers")).toHaveCount(0);
    await scope.getByRole("radio", { name: "Custom slides" }).click();
    await expect(page.getByLabel("Slide numbers")).toBeVisible();
    await scope.getByRole("radio", { name: "Current slide" }).click();
    await expect(page.getByLabel("Slide numbers")).toHaveCount(0);
  });

  test("range field rejects the documented invalid syntaxes and accepts the valid ones", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoFlow(page, EXPORT_SUNDAY);
    const popover = await openExport(page);
    await popover.getByRole("radio", { name: "Custom slides" }).click();

    const range = page.getByLabel("Slide numbers");
    const exportButton = popover.getByRole("button", { name: "Export JPG" });

    for (const [input, expectation] of [
      ["0", /must be between 1 and/i],
      ["9-2", /Use numbers and ranges/i],
      ["1,,2", /Use numbers and ranges/i],
      ["1-99", /must be between 1 and/i],
      ["a", /Use numbers and ranges/i],
      ["1--2", /Use numbers and ranges/i],
    ] as const) {
      await range.fill(input);
      await expect(popover.getByText(expectation)).toBeVisible();
      await expect(exportButton).toBeDisabled();
    }

    // Valid, including the en-dash form the design uses ("1–4, 6–7").
    for (const input of ["1-7", "1,3,5", "1-4,6-7", "1–4, 6–7"]) {
      await range.fill(input);
      await expect(popover.getByText(/Use numbers and ranges|must be between 1 and/i)).toHaveCount(0);
      await expect(exportButton).toBeEnabled();
    }
  });

  test("range field and thumbnail picker stay in sync in both directions", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoFlow(page, EXPORT_SUNDAY);
    const popover = await openExport(page);
    await popover.getByRole("radio", { name: "Custom slides" }).click();

    const range = page.getByLabel("Slide numbers");
    const thumb = (n: number) => popover.getByRole("button", { name: `Slide ${n}`, exact: true });

    // Thumbnails -> field.
    for (const n of [1, 2, 3, 4, 6, 7]) await thumb(n).click();
    await expect(range).toHaveValue("1-4, 6-7");

    // Field -> thumbnails (including the en-dash form).
    await range.fill("2–3, 8");
    for (const n of [2, 3, 8]) await expect(thumb(n)).toHaveAttribute("aria-pressed", "true");
    for (const n of [1, 4, 5, 6, 7]) await expect(thumb(n)).toHaveAttribute("aria-pressed", "false");

    // Deselecting via the thumbnails rewrites the field.
    await thumb(8).click();
    await expect(range).toHaveValue("2-3");
  });

  test("downloads a single JPG, a ZIP of the deck, and an MP4", async ({ page }) => {
    test.setTimeout(240_000);
    await loginPinAndWait(page);
    await gotoFlow(page, EXPORT_SUNDAY);

    // Single slide -> one JPG named "<index>-<headline-slug>.jpg".
    let popover = await openExport(page);
    await popover.getByRole("radio", { name: "Current slide" }).click();
    const jpgPromise = page.waitForEvent("download", { timeout: 180_000 });
    await popover.getByRole("button", { name: "Export JPG" }).click();
    const jpg = await jpgPromise;
    expect(jpg.suggestedFilename()).toMatch(/^\d\d-[a-z0-9-]+\.jpg$/);

    // Whole deck -> ZIP.
    await page.reload();
    await page.locator("[data-slide-card]").first().waitFor();
    popover = await openExport(page);
    await popover.getByRole("radio", { name: "All slides" }).click();
    const zipPromise = page.waitForEvent("download", { timeout: 180_000 });
    await popover.getByRole("button", { name: "Export JPG" }).click();
    const zip = await zipPromise;
    expect(zip.suggestedFilename()).toMatch(/^\d{4}-\d{2}-\d{2}-sunday-flow\.zip$/);

    // MP4.
    await page.reload();
    await page.locator("[data-slide-card]").first().waitFor();
    popover = await openExport(page);
    await popover.getByRole("radiogroup", { name: "Format" }).getByRole("radio", { name: "MP4" }).click();
    await popover.getByRole("radio", { name: "All slides" }).click();
    const mp4Promise = page.waitForEvent("download", { timeout: 180_000 });
    await popover.getByRole("button", { name: "Export MP4" }).click();
    const mp4 = await mp4Promise;
    expect(mp4.suggestedFilename()).toMatch(/^\d{4}-\d{2}-\d{2}-sunday-flow\.mp4$/);
  });
});

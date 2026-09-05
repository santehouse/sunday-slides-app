import { test, expect, type Page } from "@playwright/test";
import { DEMO_SUNDAY_DATE, gotoFlow, loginPinAndWait } from "./helpers";

/**
 * BUILD_HANDOFF sections 11/12/48 — the constrained slide editor: required fields,
 * the text-fit Message State, export blocking on overflow, template switching and
 * the background controls.
 *
 * Every spec addresses slides by their position in the Sunday Flow (titles change as
 * these tests edit them) and restores what it changed, because the whole suite shares a
 * single in-memory mock store.
 */

const LONG_HEADLINE =
  "VEILLÉE DES HOMMES ET DES FEMMES DE TOUTE LA RÉGION MÉTROPOLITAINE AVEC LOUANGE ADORATION " +
  "ENSEIGNEMENT PRIÈRE COMMUNION FRATERNELLE ET UN REPAS PARTAGÉ APRÈS LA RENCONTRE";

/**
 * The overflow spec runs against 2026-08-23 (index 4, "École du dimanche"), not the demo
 * Sunday: saving a slide clears its "needs review" flag, and `tests/e2e/sunday/02-flow`
 * asserts that the demo Sunday still has one. Every slide on 2026-08-23 is ready, so the
 * export gate there is a clean before/after.
 */
const OVERFLOW_SUNDAY = "2026-08-23";
const OVERFLOW_INDEX = 4;

/** Opens the editor for the slide at `index` (0-based) in Sunday Flow order. */
async function openEditorAt(page: Page, index: number, date = DEMO_SUNDAY_DATE) {
  await gotoFlow(page, date);
  await page.locator("[data-slide-card]").nth(index).click();
  await page.getByRole("button", { name: "Edit slide" }).click();
  await page.waitForURL(/\/slide\//);
  await expect(page.getByRole("heading", { name: "Content" })).toBeVisible();
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Slide saved")).toBeVisible();
}

/** "Veillée des hommes" in the seeded demo Sunday — read, never saved, by the spec below. */
const VEILLEE_INDEX = 5;
const WELCOME_INDEX = 0;
const BIBLE_STUDY_INDEX = 3;
const BAPTISMS_INDEX = 4;

test.describe("Slide editor", () => {
  test("required fields are validated on save", async ({ page }) => {
    await loginPinAndWait(page);
    await openEditorAt(page, WELCOME_INDEX);

    const headline = page.getByLabel(/^Headline/);
    const original = await headline.inputValue();
    expect(original.length).toBeGreaterThan(0);

    try {
      await headline.fill("");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("This field is required.")).toBeVisible();
    } finally {
      await headline.fill(original);
      await save(page);
    }
    await expect(page.getByText("This field is required.")).toHaveCount(0);
  });

  test("overflowing text shows an error Message State, marks the slide invalid and blocks export", async ({ page }) => {
    await loginPinAndWait(page);
    await openEditorAt(page, OVERFLOW_INDEX, OVERFLOW_SUNDAY);

    const headline = page.getByLabel(/^Headline/);
    const original = await headline.inputValue();

    try {
      await headline.fill(LONG_HEADLINE);
      await expect(page.getByText("Text is too long")).toBeVisible();
      await expect(page.getByText("Shorten the text before exporting.")).toBeVisible();
      await save(page);

      // The flow card reports the overflow and export is refused.
      await gotoFlow(page, OVERFLOW_SUNDAY);
      await expect(page.locator("[data-slide-card]").nth(OVERFLOW_INDEX)).toContainText("Text is too long");

      await page.getByRole("button", { name: /^Export/ }).click();
      const popover = page.getByRole("dialog");
      await expect(popover.getByRole("button", { name: "Export JPG" })).toBeDisabled();
      await expect(popover).toContainText("text that doesn’t fit");
      await page.keyboard.press("Escape");
    } finally {
      await openEditorAt(page, OVERFLOW_INDEX, OVERFLOW_SUNDAY);
      await page.getByLabel(/^Headline/).fill(original);
      await expect(page.getByText("Text is too long")).toHaveCount(0);
      await save(page);
    }

    // Back to ready: export is available again.
    await gotoFlow(page, OVERFLOW_SUNDAY);
    await expect(page.locator("[data-slide-card]").nth(OVERFLOW_INDEX)).toContainText("Ready");
    await page.getByRole("button", { name: /^Export/ }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Export JPG" })).toBeEnabled();
  });

  test("switching template preserves compatible field values", async ({ page }) => {
    await loginPinAndWait(page);
    await openEditorAt(page, BIBLE_STUDY_INDEX);

    const headline = await page.getByLabel(/^Headline/).inputValue();
    const line1 = await page.getByLabel("Line 1").inputValue();
    expect(line1.length).toBeGreaterThan(0);

    const select = page.getByLabel("Template");
    const original = await select.inputValue();

    await select.selectOption({ label: "General announcement" });
    await expect(page.getByLabel(/^Headline/)).toHaveValue(headline);
    await expect(page.getByLabel("Line 1")).toHaveValue(line1);

    await select.selectOption(original);
    await expect(page.getByLabel(/^Headline/)).toHaveValue(headline);
    await expect(page.getByLabel("Line 1")).toHaveValue(line1);
  });

  test("background offers approved colours and published images, never a hex picker", async ({ page }) => {
    await loginPinAndWait(page);
    await openEditorAt(page, VEILLEE_INDEX);

    const group = page.getByRole("radiogroup", { name: "Background" });
    await expect(group).toBeVisible();

    // Colour mode: an admin-approved colour listbox with swatches. Never a free hex input.
    await group.getByRole("radio", { name: "Color" }).click();
    const colorTrigger = page.getByRole("button", { name: "Approved color" });
    await expect(colorTrigger).toBeVisible();
    await expect(page.locator('input[type="color"]')).toHaveCount(0);

    await colorTrigger.click();
    const colourList = page.getByRole("listbox", { name: "Approved color" });
    const colours = colourList.getByRole("option");
    expect(await colours.count(), "more than one approved colour is offered").toBeGreaterThan(1);

    // Every option carries a visible name and a swatch — colour is never the only signal.
    const firstLabel = (await colours.nth(0).innerText()).trim();
    const secondLabel = (await colours.nth(1).innerText()).trim();
    expect(firstLabel.length).toBeGreaterThan(0);
    expect(secondLabel).not.toBe(firstLabel);

    await colours.nth(1).click();
    await expect(colorTrigger).toContainText(secondLabel);

    await colorTrigger.click();
    await colourList.getByRole("option").nth(0).click();
    await expect(colorTrigger).toContainText(firstLabel);

    // This template allows no assets, so Image is present but inert (Figma 35:570).
    await expect(group.getByRole("radio", { name: "Image" })).toBeDisabled();
  });

  test("image background offers published assets only — the Sunday team cannot upload", async ({ page }) => {
    await loginPinAndWait(page);
    // "Je suis avec vous" uses the Annual theme template, which allows approved assets.
    // Addressed by title, not position: reorder specs may have run before this one.
    await gotoFlow(page);
    await page.locator("[data-slide-card]").filter({ hasText: /JE SUIS AVEC VOUS/i }).first().click();
    await page.getByRole("button", { name: "Edit slide" }).click();
    await page.waitForURL(/\/slide\//);
    await expect(page.getByRole("heading", { name: "Content" })).toBeVisible();

    const group = page.getByRole("radiogroup", { name: "Background" });
    const image = group.getByRole("radio", { name: "Image" });
    await expect(image).toBeEnabled();
    await image.click();

    await expect(page.getByRole("button", { name: "Approved color" })).toHaveCount(0);
    await expect(page.locator('input[type="file"]'), "no upload control on the Sunday side").toHaveCount(0);

    const tiles = page.locator('button[aria-pressed]');
    expect(await tiles.count(), "published assets allowed for this template").toBeGreaterThan(0);

    await group.getByRole("radio", { name: "Color" }).click();
    await expect(page.getByRole("button", { name: "Approved color" })).toBeVisible();
  });

  test("Include in MP4 toggle is reflected in the flow card meta", async ({ page }) => {
    await loginPinAndWait(page);
    await openEditorAt(page, BAPTISMS_INDEX);

    const toggle = page.getByRole("switch", { name: "Include in MP4" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    try {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await save(page);

      await gotoFlow(page);
      await expect(page.locator("[data-slide-card]").nth(BAPTISMS_INDEX)).toContainText("Not in MP4");
    } finally {
      await openEditorAt(page, BAPTISMS_INDEX);
      await page.getByRole("switch", { name: "Include in MP4" }).click();
      await save(page);
    }

    await gotoFlow(page);
    await expect(page.locator("[data-slide-card]").nth(BAPTISMS_INDEX)).toContainText("Included in MP4");
  });

  test("leaving with unsaved changes asks for confirmation", async ({ page }) => {
    await loginPinAndWait(page);
    await openEditorAt(page, WELCOME_INDEX);

    await page.getByLabel("Line 1").fill("Modifié");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Discard changes?");

    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(page).toHaveURL(/\/slide\//);

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}/flow`));
  });
});

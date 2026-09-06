import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { DEMO_SUNDAY_DATE, gotoFlow, loginPinAndWait } from "./helpers";

/**
 * BUILD_HANDOFF sections 14/15/19/46 — Add Slide, slide removal (structural guard),
 * and the manual run-sheet upload -> preview -> Merge / Replace pipeline (scenario D).
 */

const RUN_SHEET = join(process.cwd(), "tests/fixtures/run-sheets/260906.docx");

/**
 * Scenario D runs against an older seeded Sunday, not the demo one: Replace regenerates
 * the whole deck, and every other spec (plus the original `tests/e2e/sunday` suite) reads
 * the demo Sunday's seeded 8 slides from the same shared mock store.
 */
const MERGE_SUNDAY = "2026-08-16";

async function slideCount(page: Page) {
  return page.locator("[data-slide-card]").count();
}

async function removeSlideAt(page: Page, index: number) {
  await page.locator("[data-slide-card]").nth(index).click();
  await page.getByRole("button", { name: "Remove slide" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await dialog.getByRole("button", { name: "Yes, remove slide" }).click();
}

test.describe("Add slide", () => {
  test("every category filter yields published templates and creating one opens the editor", async ({ page }) => {
    await loginPinAndWait(page);
    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/add`);
    await expect(page.getByRole("heading", { name: "Add slide" })).toBeVisible();

    const chips = page.getByRole("button", { name: /^(All|General|Events|Special|Giving|Welcome|Theme|Closing)$/ });
    expect(await chips.count(), "all eight Figma category chips are present").toBe(8);

    const cards = page.locator('button[aria-label^="Use "]');
    const allCount = await cards.count();
    expect(allCount).toBeGreaterThan(0);

    // Only Published templates are offered to the Sunday team.
    for (const label of await cards.allInnerTexts()) {
      expect(label).toContain("Published");
      expect(label).not.toContain("Draft");
      expect(label).not.toContain("Archived");
    }

    // Each chip filters without ever exceeding the unfiltered set.
    for (const name of ["General", "Events", "Special", "Giving", "Welcome", "Theme", "Closing"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
      expect(await cards.count()).toBeLessThanOrEqual(allCount);
    }

    await page.getByRole("button", { name: "All", exact: true }).click();
    const before = await (async () => {
      await gotoFlow(page);
      return slideCount(page);
    })();

    // Creating a slide from a template lands in the editor and joins the flow.
    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/add`);
    await cards.filter({ hasText: "General announcement" }).first().click();
    await page.waitForURL(/\/slide\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Content" })).toBeVisible();

    await gotoFlow(page);
    expect(await slideCount(page)).toBe(before + 1);

    // Clean up: the new slide is last and removable.
    await removeSlideAt(page, before);
    await expect(page.locator("[data-slide-card]")).toHaveCount(before);
  });
});

test.describe("Remove slide", () => {
  test("a structural 'always' slide is refused with a translated explanation", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoFlow(page);
    const before = await slideCount(page);

    // The Welcome slide is a structural default with rule "always". Addressed by title,
    // not position, so an earlier reorder spec cannot make this test remove the wrong slide.
    await page.locator("[data-slide-card]").filter({ hasText: /BIENVENUE/i }).first().click();
    await page.getByRole("button", { name: "Remove slide" }).click();
    const removeDialog = page.getByRole("dialog");
    await removeDialog.getByRole("button", { name: "Confirm" }).click();
    await removeDialog.getByRole("button", { name: "Yes, remove slide" }).click();
    await expect(page.getByText("This slide is always included and can’t be removed.")).toBeVisible();
    await expect(page.locator("[data-slide-card]")).toHaveCount(before);
  });
});

test.describe("Run sheet upload (scenario D)", () => {
  test("upload -> preview -> Merge keeps a manual edit; Replace regenerates the deck", async ({ page }) => {
    test.setTimeout(180_000);
    await loginPinAndWait(page);

    // 1. Make a manual edit that merge must preserve.
    await gotoFlow(page, MERGE_SUNDAY);
    await page.locator("[data-slide-card]").nth(1).click();
    await page.getByRole("button", { name: "Edit slide" }).click();
    await page.waitForURL(/\/slide\//);
    const marker = `Modifié par l’équipe ${Date.now() % 100000}`;
    await page.getByLabel("Line 1").fill(marker);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Slide saved")).toBeVisible();

    // 2. Upload the real run sheet and wait for the preview.
    await page.goto(`/sunday/${MERGE_SUNDAY}/upload`);
    await expect(page.getByRole("heading", { name: "Manual upload" })).toBeVisible();
    await page.setInputFiles('input[type="file"]', RUN_SHEET);

    await expect(page.getByText("260906.docx").last()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("button", { name: "Merge updates" })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/announcements found/)).toBeVisible();

    // 3. Merge — the manual edit survives (BUILD_HANDOFF section 15).
    await page.getByRole("button", { name: "Merge updates" }).click();
    await page.waitForURL(/\/flow$/, { timeout: 60_000 });
    expect(await page.locator("[data-slide-card]").count()).toBeGreaterThan(0);

    // The edited slide still carries the manual copy.
    const editedStillThere = await page.evaluate(async (m) => {
      const res = await fetch(location.pathname, { headers: { accept: "text/html" } });
      return (await res.text()).includes(m);
    }, marker);
    expect(editedStillThere, "merge preserved the manual edit").toBe(true);

    // 4. Replace regenerates the deck (destructive, behind a confirm dialog).
    await page.goto(`/sunday/${MERGE_SUNDAY}/upload`);
    // Wait for the hydrated page (not the streamed loading skeleton) before attaching the file.
    await expect(page.getByRole("heading", { name: "Manual upload" })).toBeVisible();
    await page.setInputFiles('input[type="file"]', RUN_SHEET);
    await expect(page.getByRole("button", { name: "Replace deck" })).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: "Replace deck" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Replace the whole deck?");
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect(dialog).toContainText("Last check — replace everything?");
    await dialog.getByRole("button", { name: "Yes, replace the deck" }).click();
    await page.waitForURL(/\/flow$/, { timeout: 60_000 });

    const afterReplace = await page.evaluate(async (m) => {
      const res = await fetch(location.pathname, { headers: { accept: "text/html" } });
      return (await res.text()).includes(m);
    }, marker);
    expect(afterReplace, "replace regenerated the slide, dropping the manual edit").toBe(false);
  });
});

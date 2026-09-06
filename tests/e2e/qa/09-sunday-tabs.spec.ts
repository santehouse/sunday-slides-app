import { test, expect } from "@playwright/test";
import { DEMO_SUNDAY_DATE, gotoFlow, loginPinAndWait, SUNDAY_PIN } from "./helpers";

/**
 * Contextual navigation for the Sunday side: the SundayTabs strip (Overview / Sunday
 * flow / Run sheet), the Week Switcher carrying the current tab across a week switch,
 * the Overview Export popover (no "Current slide" scope), the "Needs review" metric
 * linking into Flow, and the drill-in breadcrumb (Slide Editor / Add slide).
 *
 * Runs against the seeded demo Sunday (2026-09-06, read-only) — "Veillée des hommes" is
 * the one seeded `needs_review` slide these specs rely on.
 */

test.describe("Sunday tabs", () => {
  test("render on Overview, Flow, and Run sheet with the right aria-current", async ({ page }) => {
    await loginPinAndWait(page);
    const tabs = page.getByRole("navigation", { name: "Sunday sections" });

    await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("link", { name: "Sunday flow" })).not.toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("link", { name: "Run sheet" })).not.toHaveAttribute("aria-current", "page");

    // The one seeded needs_review slide surfaces as a count pill on the Flow tab.
    await expect(page.getByLabel("1 slide needs review")).toBeVisible();

    await tabs.getByRole("link", { name: "Sunday flow" }).click();
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}/flow$`));
    await expect(tabs.getByRole("link", { name: "Sunday flow" })).toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current", "page");

    await tabs.getByRole("link", { name: "Run sheet" }).click();
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}/upload$`));
    await expect(tabs.getByRole("link", { name: "Run sheet" })).toHaveAttribute("aria-current", "page");

    // The header title (the Sunday date) stays stable across every tab.
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sunday, September 6");
  });

  test("switching week from Flow lands on the adjacent Sunday's Flow", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoFlow(page);

    await page.getByRole("button", { name: "Previous Sunday" }).click();
    await page.waitForURL(/\/sunday\/2026-08-30\/flow$/);
    const tabs = page.getByRole("navigation", { name: "Sunday sections" });
    await expect(tabs.getByRole("link", { name: "Sunday flow" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("button", { name: "Next Sunday" }).click();
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}/flow$`));
    await expect(tabs.getByRole("link", { name: "Sunday flow" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Overview screen", () => {
  test("Export popover opens and has no Current slide scope option", async ({ page }) => {
    await loginPinAndWait(page);
    await page.getByRole("button", { name: /^Export/ }).click();
    const popover = page.getByRole("dialog");
    await expect(popover.getByRole("radio", { name: "All slides" })).toBeVisible();
    await expect(popover.getByRole("radio", { name: "Current slide" })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("the Needs review metric links to Flow with the flagged slide selected", async ({ page }) => {
    await loginPinAndWait(page);
    // Scoped to the stat-card grid: "Needs review" text also appears on the Flow tab's
    // count pill and on the flagged slide's own row in the Sunday Flow panel below.
    const metric = page.locator(".grid.grid-cols-4").getByRole("link");
    await expect(metric).toBeVisible();
    await expect(metric).toContainText("Needs review");
    await metric.click();

    await page.waitForURL(/\/flow\?slide=/);
    const reviewCard = page.locator("[data-slide-card]").filter({ hasText: /veillée des hommes/i });
    await expect(reviewCard).toHaveAttribute("aria-current", "true");
  });
});

test.describe("Drill-in breadcrumb", () => {
  test("Slide Editor breadcrumb renders and a clean link navigates straight through", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoFlow(page);
    await page.locator("[data-slide-card] [data-slide-select]").first().dblclick();
    await page.waitForURL(/\/slide\//);

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText("Sunday, Sep 6")).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "Sunday, Sep 6" })).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "Sunday flow" })).toBeVisible();

    // No unsaved changes: the link navigates straight through, no confirm dialog.
    await breadcrumb.getByRole("link", { name: "Sunday flow" }).click();
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}/flow$`));
  });

  test("Slide Editor breadcrumb intercepts navigation while there are unsaved changes", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoFlow(page);
    await page.locator("[data-slide-card] [data-slide-select]").first().dblclick();
    await page.waitForURL(/\/slide\//);

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await page.getByLabel("Line 1").fill("Modifié par le fil d’Ariane");

    // First click: confirm dialog, "Keep editing" cancels and leaves the field dirty.
    await breadcrumb.getByRole("link", { name: "Sunday flow" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Discard changes?");
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(page).toHaveURL(/\/slide\//);
    await expect(page.getByLabel("Line 1")).toHaveValue("Modifié par le fil d’Ariane");

    // Second click, same still-dirty field: "Discard" confirms and completes the navigation.
    await breadcrumb.getByRole("link", { name: "Sunday flow" }).click();
    await expect(page.getByRole("dialog")).toContainText("Discard changes?");
    await page.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}/flow$`));
    // The edit was never saved, so discarding it leaves no state for later specs to clean up.
  });

  test("Add slide breadcrumb links navigate to Overview and Flow", async ({ page }) => {
    await loginPinAndWait(page);
    await page.goto(`/sunday/${DEMO_SUNDAY_DATE}/add`);

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText("Add slide", { exact: true })).toBeVisible();

    await breadcrumb.getByRole("link", { name: "Sunday flow" }).click();
    await page.waitForURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}/flow$`));
  });
});

test.describe("French locale", () => {
  test("FR labels appear on the tab strip and breadcrumb", async ({ page }) => {
    await page.goto("/fr/sunday/pin");
    const inputs = page.locator('input[inputmode="numeric"]');
    for (let i = 0; i < SUNDAY_PIN.length; i++) await inputs.nth(i).fill(SUNDAY_PIN[i]!);
    await page.getByRole("button", { name: /ouvrir la présentation/i }).click();
    await page.waitForURL(/\/fr\/sunday\/\d{4}-\d{2}-\d{2}$/);

    const tabs = page.getByRole("navigation", { name: "Sections du dimanche" });
    await expect(tabs.getByRole("link", { name: "Aperçu" })).toHaveAttribute("aria-current", "page");
    // Selected by href, not name: "Déroulement" is also a substring of "Feuille de déroulement".
    await expect(tabs.locator('a[href$="/flow"]')).toContainText("Déroulement");
    await expect(tabs.getByRole("link", { name: "Feuille de déroulement" })).toBeVisible();

    await page.goto(`/fr/sunday/${DEMO_SUNDAY_DATE}/add`);
    await expect(page.getByRole("navigation", { name: /fil d.ariane/i })).toBeVisible();
  });
});

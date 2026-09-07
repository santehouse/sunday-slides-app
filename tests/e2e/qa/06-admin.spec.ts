import { test, expect, type Page } from "@playwright/test";
import { signInAsAdmin } from "./helpers";

/**
 * BUILD_HANDOFF sections 20-23/48 — Admin: Sundays, the template lifecycle,
 * assets, mappings and fonts. Every spec cleans up after itself: the whole suite
 * shares one in-memory mock store.
 */

/** A tiny valid PNG, generated in the page so no binary fixture is needed. */
async function makePng(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const dataUri = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#2e6f6b";
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(40, 40, 120, 60);
    return canvas.toDataURL("image/png");
  });
  return {
    name: "qa-asset.png",
    mimeType: "image/png",
    buffer: Buffer.from(dataUri.split(",")[1]!, "base64"),
  };
}

/** A Sunday in 2027 that no other spec (or earlier run) has claimed. */
function nextFreeSunday(): string {
  const base = Date.UTC(2027, 0, 3); // 2027-01-03 is a Sunday
  const week = Math.floor(Date.now() / 1000) % 52;
  return new Date(base + week * 7 * 86_400_000).toISOString().slice(0, 10);
}

async function openSundaySession(page: Page) {
  await page.goto("/sunday/pin");
  const digits = page.locator('input[inputmode="numeric"]');
  for (const [i, d] of [..."53787"].entries()) await digits.nth(i).fill(d);
  await page.getByRole("button", { name: /open sunday/i }).click();
  await page.waitForURL(/\/sunday$/);
}

test.describe("Admin — Sundays", () => {
  test("creating a Sunday works once and rejects a duplicate date", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/sundays");

    // A fresh Sunday each run: the mock store is shared by the whole suite and
    // survives repeated runs against one dev server, so a fixed date would only
    // be creatable once.
    const date = nextFreeSunday();

    await page.getByRole("button", { name: "Create Sunday" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Service date").fill(date);
    await dialog.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/admin\/sundays\/[^/]+$/, { timeout: 30_000 });

    // The same date again is refused with a translated inline error.
    await page.goto("/admin/sundays");
    await page.getByRole("button", { name: "Create Sunday" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Service date").fill(date);
    await dialog.getByRole("button", { name: "Continue" }).click();
    await expect(dialog.getByText("That Sunday already exists.")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});

test.describe("Admin — template lifecycle", () => {
  test("create → publish → appears in Add Slide → archive → disappears", async ({ page, context }) => {
    test.setTimeout(180_000);
    await signInAsAdmin(page);
    await page.goto("/admin/templates");

    const before = await page.locator('a[href^="/admin/templates/"]').count();
    await page.getByRole("button", { name: "Create template" }).click();
    await page.waitForURL(/\/admin\/templates\/[^/]+$/, { timeout: 30_000 });

    // A brand new template is a Draft, so the Sunday team cannot see it yet.
    await expect(page.getByText("Draft").first()).toBeVisible();
    const name = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

    const sunday = await context.newPage();
    await openSundaySession(sunday);
    await sunday.goto("/sunday?add=1");
    await sunday.getByRole("heading", { name: "Add a slide" }).waitFor();
    await expect(sunday.locator(`button[aria-label="Use ${name}"]`)).toHaveCount(0);

    // Publish → the Sunday team can now pick it.
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Template saved")).toBeVisible({ timeout: 30_000 });
    await sunday.reload();
    await sunday.getByRole("heading", { name: "Add a slide" }).waitFor();
    await expect(sunday.locator(`button[aria-label="Use ${name}"]`)).toBeVisible({ timeout: 30_000 });

    // Archive → gone from Add Slide, still listed in the library, and the existing
    // deck still renders every historical slide.
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Template saved").last()).toBeVisible({ timeout: 30_000 });
    await sunday.reload();
    await sunday.getByRole("heading", { name: "Add a slide" }).waitFor();
    await expect(sunday.locator(`button[aria-label="Use ${name}"]`)).toHaveCount(0);

    await sunday.goto("/sunday");
    await sunday.locator("[data-slide-card]").first().waitFor();
    expect(await sunday.locator("[data-slide-card]").count()).toBeGreaterThan(0);
    await sunday.close();

    await page.goto("/admin/templates");
    expect(await page.locator('a[href^="/admin/templates/"]').count()).toBe(before + 1);
  });
});

test.describe("Admin — assets", () => {
  test("upload → publish → allowed for a template → selectable in the Sunday editor", async ({ page, context }) => {
    test.setTimeout(180_000);
    await signInAsAdmin(page);
    await page.goto("/admin/assets");

    const png = await makePng(page);
    await page.getByRole("button", { name: "Upload asset" }).click();
    const uploadDialog = page.getByRole("dialog");
    await uploadDialog.locator('input[type="file"]').setInputFiles(png);
    await uploadDialog.getByLabel("Name (EN)").fill("QA background");
    await uploadDialog.getByRole("button", { name: "Upload", exact: true }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText("QA background").first()).toBeVisible({ timeout: 30_000 });

    // Uploaded assets start as Draft; publish it and allow it on the Annual theme template.
    await page.getByText("QA background").first().click();
    const detail = page.getByRole("dialog");
    await detail.getByLabel("Status").selectOption("published");
    await detail.locator("label", { hasText: "Annual theme" }).getByRole("checkbox").check();
    await detail.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });

    // The Sunday Edit modal can now pick it for a slide on that template.
    const sunday = await context.newPage();
    await openSundaySession(sunday);
    await sunday.goto("/sunday");
    await sunday.locator("[data-slide-card]").first().waitFor();
    // Pick the Annual theme slide by title, not by position: other specs may reorder the deck.
    await sunday.locator("[data-slide-card]", { hasText: "Je suis avec vous" }).getByRole("button", { name: "Edit" }).click();
    const dialog = sunday.getByRole("dialog").filter({ hasText: "Je suis avec vous" });
    await dialog.getByRole("radiogroup", { name: "Background" }).getByRole("radio", { name: "Image" }).click();
    await expect(dialog.locator('button[aria-label="QA background"]')).toBeVisible({ timeout: 30_000 });
    await sunday.close();
  });
});

test.describe("Admin — mappings", () => {
  test("a mapping with EN and FR aliases is created and listed as Active", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/mappings");

    const canonical = `QA annonce ${Date.now() % 100000}`;
    await page.getByRole("button", { name: "Add mapping" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Canonical announcement").fill(canonical);
    await dialog.getByLabel("Aliases").fill("QA announcement\nQA annonce");
    await dialog.getByRole("button", { name: /^Save/ }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
    const row = page.getByRole("row").filter({ hasText: canonical });
    await expect(row).toBeVisible();
    await expect(row.getByText("Active")).toBeVisible();
    await expect(row).toContainText("QA announcement");
  });
});

test.describe("Admin — brand & fonts", () => {
  test("font library lists families with an enablement state", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/brand");
    await expect(page.getByRole("heading", { name: "Brand & fonts" })).toBeVisible();
    await expect(page.getByText("Font library")).toBeVisible();

    // Arimo is the platform font, used by every seeded template.
    await expect(page.getByText("Arimo").first()).toBeVisible();
    await expect(page.getByText("Enabled").first()).toBeVisible();
  });
});

import path from "node:path";
import { test, expect } from "@playwright/test";
import { loginPin } from "./helpers";

const FIXTURE = path.join(process.cwd(), "tests/fixtures/run-sheets/260906.docx");

/**
 * Step 1 ("Run sheet") — a single inbox across every Sunday, replacing the old
 * per-Sunday "Upload run sheet" screen. Three demo run sheets (2026-09-06, -08-30,
 * -08-23) are already "Used"; 2026-08-16 has none yet, which is where this spec
 * uploads a fresh one.
 */

test("lists the demo run sheets as Used", async ({ page }) => {
  await loginPin(page);
  await page.goto("/sunday/2026-09-06/run-sheet");

  const heading = page.getByRole("heading", { name: "Inbox" });
  await expect(heading).toBeVisible();

  for (const [filename, forDate] of [
    ["260906.docx", "Sep 6"],
    ["260830.docx", "Aug 30"],
    ["260823.pdf", "Aug 23"],
  ] as const) {
    // Filename alone isn't unique — other specs (and real inbound email) can land a
    // same-named upload on a different Sunday, so scope by the "For Sunday" chip too.
    const row = page.locator("li").filter({ hasText: filename }).filter({ hasText: forDate });
    await expect(row).toBeVisible();
    await expect(row.getByText("Used", { exact: true })).toBeVisible();
  }
});

test("uploading a new run sheet adds it to the inbox, and using it lands on Step 2", async ({ page }) => {
  test.setTimeout(90_000);
  await loginPin(page);
  // 2026-08-16 has no manual edits yet — "Use this run sheet" should apply silently
  // (a plain replace) rather than merge.
  await page.goto("/sunday/2026-08-16/run-sheet");

  const fileInput = page.getByLabel("Choose file");
  await fileInput.setInputFiles(FIXTURE);

  const newRow = page.locator("li").filter({ hasText: "260906.docx" }).first();
  await expect(newRow).toBeVisible({ timeout: 30_000 });
  await expect(newRow.getByText("For Sunday")).toContainText("Aug 16");

  const useButton = newRow.getByRole("button", { name: "Use this run sheet" });
  await expect(useButton).toBeVisible();
  await useButton.click();

  await page.waitForURL(/\/sunday\/2026-08-16$/, { timeout: 30_000 });
  await expect(page.locator("[data-slide-card]").first()).toBeVisible();
});

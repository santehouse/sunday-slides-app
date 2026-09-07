import path from "node:path";
import { test, expect } from "@playwright/test";
import { loginPin } from "./helpers";

const FIXTURE = path.join(process.cwd(), "tests/fixtures/run-sheets/260906.docx");

/**
 * The Import modal ("Import announcements"): upload on the left, "Received files" on
 * the right (the last 6 run sheets across every Sunday). Uses the real fixture DOCX,
 * parsed through the offline heuristic parser in mock mode (no OpenAI key in e2e).
 */

test("lists the seeded run sheets as received files, already opened", async ({ page }) => {
  await loginPin(page);
  await page.getByRole("button", { name: "Import announcements" }).click();
  await expect(page.getByRole("heading", { name: "Import announcements" })).toBeVisible();

  const heading = page.getByRole("heading", { name: "Received files" });
  await expect(heading).toBeVisible();

  for (const filename of ["260906.docx", "260830.docx", "260823.pdf"]) {
    // `.last()`: the seeded file is the oldest row with that name — other specs may have
    // uploaded the same fixture again since (newer rows sort first).
    const row = page.getByRole("dialog", { name: "Import announcements" }).locator("li").filter({ hasText: filename }).last();
    await expect(row).toBeVisible();
    // Every seeded run sheet was already "added to flow" at seed time, so it carries no
    // unread indicator — only a freshly uploaded file does (see the next test).
    await expect(row.getByText("New — not opened yet")).toHaveCount(0);
  }

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("uploading a file shows a new-dot, previewing it clears the dot, and using it fills the queue", async ({ page }) => {
  test.setTimeout(90_000);
  await loginPin(page);
  await page.getByRole("button", { name: "Import announcements" }).click();
  await expect(page.getByRole("heading", { name: "Import announcements" })).toBeVisible();

  const importDialog = page.getByRole("dialog", { name: "Import announcements" });
  const uploadedRows = importDialog.locator("li").filter({ hasText: "260906.docx" }).filter({ hasText: "Uploaded" });
  const uploadedBefore = await uploadedRows.count();

  const fileInput = page.getByLabel("Choose file");
  await fileInput.setInputFiles(FIXTURE);

  // Wait for the upload itself to land in "Received files" (newest first) before touching
  // any row — otherwise an older unopened copy of the fixture would be picked instead.
  await expect(uploadedRows).toHaveCount(uploadedBefore + 1, { timeout: 30_000 });
  const newRow = uploadedRows.first();
  await expect(newRow).toBeVisible();
  await expect(newRow.locator("span.sr-only", { hasText: "New — not opened yet" })).toHaveCount(1);

  // Preview the DOCX: extracted text renders in a scrollable panel.
  await newRow.getByRole("button", { name: /preview 260906\.docx/i }).click();
  const previewDialog = page.getByRole("dialog", { name: "260906.docx" });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog).toContainText("ÉTUDE BIBLIQUE", { timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(previewDialog).toHaveCount(0);

  // The new-dot clears once the file has been opened.
  await expect(newRow.locator("span.sr-only", { hasText: "New — not opened yet" })).toHaveCount(0);

  // Use this file — applies to the current service (replace, since nothing here has
  // been manually edited) and closes the modal.
  await newRow.getByRole("button", { name: "Use this file" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(/Announcements added/)).toBeVisible();

  await page.locator("[data-slide-card]").first().waitFor();
  // The real run sheet yields 8 announcements plus the 4 structural slides.
  await expect(page.locator("[data-slide-card]")).toHaveCount(12);
  await expect(page.locator("[data-slide-card]").filter({ hasText: /veillée des hommes/i })).toBeVisible();
});

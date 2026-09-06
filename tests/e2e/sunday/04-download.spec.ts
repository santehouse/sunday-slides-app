import { test, expect } from "@playwright/test";
import { loginPin } from "./helpers";

/**
 * Step 3 ("Download") — blocked state when a slide can't be exported, the two quick
 * download cards, and the "Advanced options" disclosure that carries the old
 * ExportPopover's custom-selection UI (format, scope, range field <-> thumbnails).
 */

test("an overflowing slide blocks Step 3 with a plain-language message", async ({ page }) => {
  test.setTimeout(60_000);
  await loginPin(page);
  await page.goto("/sunday/2026-08-23/download");
  // Nothing invalid yet — the quick download cards are showing.
  await expect(page.getByRole("heading", { name: "Download pictures" })).toBeVisible();

  await page.goto("/sunday/2026-08-23");
  await page.locator("[data-slide-card]").filter({ hasText: /école du dimanche/i }).click();
  await page.getByLabel("Headline").fill("X".repeat(400));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("This is too long")).toBeVisible();

  await page.goto("/sunday/2026-08-23/download");
  await expect(page.getByRole("alert").filter({ hasText: "Fix 1 slides first" })).toBeVisible();
  await page.getByRole("button", { name: "Back to check slides" }).click();
  await page.waitForURL(/\/sunday\/2026-08-23$/);
});

test("downloads pictures as a ZIP and the video as an MP4 with correct content types", async ({ page }) => {
  test.setTimeout(240_000);
  await loginPin(page);
  await page.goto("/sunday/2026-08-30/download");

  const picturesResponse = page.waitForResponse((res) => res.url().includes("/api/export") && res.request().method() === "POST");
  const picturesDownload = page.waitForEvent("download", { timeout: 180_000 });
  await page.getByRole("button", { name: "Download pictures" }).click();
  const [picturesRes, picturesFile] = await Promise.all([picturesResponse, picturesDownload]);
  expect(picturesRes.headers()["content-type"]).toBe("application/zip");
  expect(picturesFile.suggestedFilename()).toMatch(/\.zip$/);

  const videoResponse = page.waitForResponse((res) => res.url().includes("/api/export") && res.request().method() === "POST");
  const videoDownload = page.waitForEvent("download", { timeout: 180_000 });
  await page.getByRole("button", { name: "Download video" }).click();
  const [videoRes, videoFile] = await Promise.all([videoResponse, videoDownload]);
  expect(videoRes.headers()["content-type"]).toBe("video/mp4");
  expect(videoFile.suggestedFilename()).toMatch(/\.mp4$/);
});

test("Advanced options keep the range field and thumbnail picker in sync", async ({ page }) => {
  await loginPin(page);
  await page.goto("/sunday/2026-08-30/download");

  await page.getByRole("button", { name: "Advanced options" }).click();
  await page.getByRole("radio", { name: "Chosen slides" }).click();

  const range = page.getByLabel("Slide numbers");
  const thumb = (n: number) => page.getByRole("button", { name: `Slide ${n}`, exact: true });

  for (const n of [1, 2, 3, 4, 6, 7]) await thumb(n).click();
  await expect(range).toHaveValue("1-4, 6-7");

  for (const n of [1, 2, 3, 4, 6, 7]) await thumb(n).click();
  await range.fill("1-4, 6-7");
  for (const n of [1, 2, 3, 4, 6, 7]) await expect(thumb(n)).toHaveAttribute("aria-pressed", "true");
  await expect(thumb(5)).toHaveAttribute("aria-pressed", "false");
});

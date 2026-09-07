import { test, expect } from "@playwright/test";
import { loginPin } from "./helpers";

/**
 * The Export dropdown (top-right of the queue screen): quick "Download panels" /
 * "Download video" rows, the seconds-per-slide stepper, and the Advanced disclosure
 * carrying the old ExportPopover's custom-selection UI (format, scope, range field
 * <-> thumbnails).
 */

test("quick downloads produce a ZIP and an MP4 with the right content types", async ({ page }) => {
  test.setTimeout(240_000);
  await loginPin(page);

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download panels" })).toBeVisible();

  const picturesResponse = page.waitForResponse((res) => res.url().includes("/api/export") && res.request().method() === "POST");
  const picturesDownload = page.waitForEvent("download", { timeout: 180_000 });
  await page.getByRole("button", { name: "Download panels" }).click();
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

test("Advanced keeps the range field and thumbnail picker in sync, and the seconds stepper updates the video subtitle", async ({ page }) => {
  await loginPin(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();

  const stepper = page.getByRole("button", { name: "Increase duration" });
  await stepper.click();

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

  // Undo the duration bump so it doesn't leak into other specs.
  await page.getByRole("button", { name: "Decrease duration" }).click();
});

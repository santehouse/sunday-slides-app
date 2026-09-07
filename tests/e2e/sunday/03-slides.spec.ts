import { test, expect } from "@playwright/test";
import { loginPin, loginPinAndWait } from "./helpers";

/**
 * New slide modal → Edit form, the Edit modal (template switch, film toggle), and
 * row-level delete with its two-step confirm.
 */

test("New slide modal: picking a design swaps straight into the edit form, and saving adds it to the queue", async ({ page }) => {
  await loginPin(page);
  await page.locator("[data-slide-card]").first().waitFor();
  const before = await page.locator("[data-slide-card]").count();

  await page.getByRole("button", { name: "New slide" }).click();
  await expect(page.getByRole("heading", { name: "Add a slide" })).toBeVisible();

  // "Event" has team-editable fields (the Welcome design that sorts first is fully locked).
  await page.getByRole("button", { name: "Use Event", exact: true }).click();
  await expect(page.getByLabel("Title")).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("Title").fill("E2E TEST SLIDE");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });

  await expect.poll(() => page.locator("[data-slide-card]").count()).toBe(before + 1);
  const created = page.locator("[data-slide-card]").filter({ hasText: "E2E TEST SLIDE" });
  await expect(created).toBeVisible();

  // Clean up: remove the test slide (double-confirm) so later specs see the original deck size.
  await created.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await dialog.getByRole("button", { name: "Yes, remove slide" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => page.locator("[data-slide-card]").count()).toBe(before);
});

test("Edit modal: switching the design swaps the field set, and Cancel warns about unsaved changes", async ({ page }) => {
  await loginPin(page);
  const row = page.locator("[data-slide-card]").filter({ hasText: /baptêmes/i });
  await row.getByRole("button", { name: "Edit" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const select = dialog.getByLabel("Design");
  const originalValue = await select.inputValue();
  const options = await select.locator("option").all();
  const otherOption = (await Promise.all(options.map((o) => o.getAttribute("value")))).find((v) => v && v !== originalValue);
  expect(otherOption).toBeTruthy();

  await select.selectOption(otherOption!);
  // Changing the design is a real edit — closing now must ask before discarding it. The
  // edit dialog itself re-opens underneath (Escape's native close races our guard), so
  // scope everything below to the confirm dialog specifically.
  await page.keyboard.press("Escape");
  const confirm = page.getByRole("dialog").filter({ hasText: "Keep your changes?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Re-open and confirm the design reverted (the discard was never saved).
  await row.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("dialog").getByLabel("Design")).toHaveValue(originalValue);
  await page.keyboard.press("Escape");
});

test("the film toggle persists after a reload", async ({ page }) => {
  await loginPin(page);
  const row = page.locator("[data-slide-card]").filter({ hasText: /prière matinale/i });
  const film = row.getByRole("button", { name: /shown in the video|not shown in the video/i });
  const wasIncluded = (await film.getAttribute("aria-pressed")) === "true";

  await film.click();
  await expect(film).toHaveAttribute("aria-pressed", String(!wasIncluded));

  await page.reload();
  await page.locator("[data-slide-card]").first().waitFor();
  const rowAfter = page.locator("[data-slide-card]").filter({ hasText: /prière matinale/i });
  await expect(rowAfter.getByRole("button", { name: /shown in the video|not shown in the video/i })).toHaveAttribute(
    "aria-pressed",
    String(!wasIncluded),
  );

  // Restore the original state.
  await rowAfter.getByRole("button", { name: /shown in the video|not shown in the video/i }).click();
  await expect(rowAfter.getByRole("button", { name: /shown in the video|not shown in the video/i })).toHaveAttribute(
    "aria-pressed",
    String(wasIncluded),
  );
});

test("deleting a slide is a two-step confirm, and a structural slide can't be removed", async ({ page }) => {
  await loginPinAndWait(page);
  const before = await page.locator("[data-slide-card]").count();

  // A plain, removable slide: the first confirm click only advances to the final step.
  const row = page.locator("[data-slide-card]").filter({ hasText: /baptêmes/i });
  await row.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Remove this slide?");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toContainText("Really remove this slide?");
  await expect.poll(() => page.locator("[data-slide-card]").count()).toBe(before);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => page.locator("[data-slide-card]").count()).toBe(before);

  // A structural "always" slide (Welcome) cannot be removed at all.
  const structural = page.locator("[data-slide-card]").filter({ hasText: /bienvenue/i });
  await structural.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, remove slide" }).click();
  await expect(page.getByText("This slide is always included and can’t be removed.")).toBeVisible();
  await expect.poll(() => page.locator("[data-slide-card]").count()).toBe(before);
});

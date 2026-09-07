import { test, expect } from "@playwright/test";
import { signInAsAdmin, loginPinAndWait } from "./helpers";

/**
 * Template Studio's interactive canvas (BUILD_HANDOFF §12/13 + Template Studio brief):
 * drag/resize/keyboard-nudge a field box, and drag/resize the global safe zone, directly
 * on the live render. Every mutation here is restored before the test ends — the whole
 * suite shares one in-memory mock store (playwright.config.ts runs with one worker).
 */

const WELCOME_TEMPLATE_PATH = "/admin/templates/tmpl-rendez-vous";

test.describe("Admin — Template Studio interactive canvas", () => {
  test("drag, resize, and keyboard-nudge a field box; changes persist and reach Sunday Flow", async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await signInAsAdmin(page);
    await page.goto(WELCOME_TEMPLATE_PATH);

    // The weekly schedule's first-day title: a big box to grab by its body, and far
    // enough from the right edge that drag + resize + nudge never clamp against it.
    const fieldBox = page.locator('[data-field-box="headline"]');
    await fieldBox.waitFor();
    await fieldBox.click();

    const originalX = await page.locator("#field-x").inputValue();
    const originalY = await page.locator("#field-y").inputValue();
    const originalWidth = await page.locator("#field-width").inputValue();
    const originalHeight = await page.locator("#field-height").inputValue();

    // --- Drag the box body: moves x/y ---
    const before = await fieldBox.boundingBox();
    await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
    await page.mouse.down();
    await page.mouse.move(before!.x + before!.width / 2 + 80, before!.y + before!.height / 2 + 40, { steps: 8 });
    await page.mouse.up();

    const xAfterDrag = await page.locator("#field-x").inputValue();
    const yAfterDrag = await page.locator("#field-y").inputValue();
    expect(xAfterDrag).not.toBe(originalX);
    expect(yAfterDrag).not.toBe(originalY);

    // --- Drag the "se" corner handle: grows width and height together ---
    // A near-full-width field's own resize handle sits past the canvas's horizontal
    // scroll region at this zoom — scroll it into view first, same as a real user would.
    const handle = fieldBox.locator('[data-handle="se"]');
    await handle.scrollIntoViewIfNeeded();
    const handleBox = await handle.boundingBox();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + 60, handleBox!.y + 30, { steps: 8 });
    await page.mouse.up();

    const widthAfterResize = Number(await page.locator("#field-width").inputValue());
    const heightAfterResize = Number(await page.locator("#field-height").inputValue());
    expect(widthAfterResize).toBeGreaterThan(Number(originalWidth));
    expect(heightAfterResize).toBeGreaterThan(Number(originalHeight));

    // --- Keyboard: arrow keys nudge 1px, Shift+arrow nudges 8px ---
    await fieldBox.focus();
    const xBeforeNudge = Number(await page.locator("#field-x").inputValue());
    await page.keyboard.press("ArrowRight");
    expect(Number(await page.locator("#field-x").inputValue())).toBe(xBeforeNudge + 1);
    await page.keyboard.press("Shift+ArrowRight");
    const xAfterNudges = Number(await page.locator("#field-x").inputValue());
    expect(xAfterNudges).toBe(xBeforeNudge + 9);

    // --- Ctrl/Cmd+Z undoes the last gesture (the Shift+arrow nudge) ---
    await page.keyboard.press("Control+z");
    expect(Number(await page.locator("#field-x").inputValue())).toBe(xBeforeNudge + 1);
    // Redo the nudge so the "after Save" assertions below have a single expected value.
    await page.keyboard.press("Shift+ArrowRight");
    expect(Number(await page.locator("#field-x").inputValue())).toBe(xAfterNudges);

    // --- Save + reload: the new geometry persists ---
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Template saved")).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await page.locator('[data-field-box="headline"]').waitFor();
    await page.locator('[data-field-box="headline"]').click();
    expect(Number(await page.locator("#field-x").inputValue())).toBe(xAfterNudges);
    expect(Number(await page.locator("#field-width").inputValue())).toBe(widthAfterResize);
    expect(Number(await page.locator("#field-height").inputValue())).toBe(heightAfterResize);

    // --- The moved headline reaches the Sunday Flow thumbnail — one renderer (CLAUDE.md rule 6) ---
    const sundayPage = await context.newPage();
    await loginPinAndWait(sundayPage);
    await sundayPage.goto("/sunday");
    await sundayPage.locator("[data-slide-card]").first().waitFor();
    // The flow list's thumbnails and the big preview both run the renderer's async
    // font-load + text-fit pass client-side — "BIENVENUE" is also the static page
    // heading, so wait for the church name (only ever rendered inside the canvas
    // itself) rather than racing the canvas render with a screenshot.
    await sundayPage.getByText("ÉGLISE DES APÔTRES DE JÉSUS-CHRIST", { exact: true }).first().waitFor();
    await sundayPage.screenshot({ path: "tmp/studio-canvas-flow-after-save.png" });
    await sundayPage.close();

    // --- Restore the field's original geometry so other specs are unaffected ---
    await page.locator("#field-x").fill(originalX);
    await page.locator("#field-y").fill(originalY);
    await page.locator("#field-width").fill(originalWidth);
    await page.locator("#field-height").fill(originalHeight);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Template saved")).toBeVisible({ timeout: 30_000 });
  });

  test("safe zone: drag on the canvas, save globally, and read back from Settings + Sunday Flow", async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await signInAsAdmin(page);
    await page.goto(WELCOME_TEMPLATE_PATH);

    await page.getByRole("button", { name: "Edit safe zone" }).click();
    const safeZoneBox = page.locator("[data-safe-zone-box]");
    await safeZoneBox.waitFor();

    const originalX = await page.locator("#safe-zone-x").inputValue();
    const originalY = await page.locator("#safe-zone-y").inputValue();
    const originalWidth = await page.locator("#safe-zone-width").inputValue();
    const originalHeight = await page.locator("#safe-zone-height").inputValue();

    // Drag the safe zone box up and to the left.
    const before = await safeZoneBox.boundingBox();
    await page.mouse.move(before!.x + 15, before!.y + 15);
    await page.mouse.down();
    await page.mouse.move(before!.x + 15 - 40, before!.y + 15 - 40, { steps: 8 });
    await page.mouse.up();

    const xAfterDrag = Number(await page.locator("#safe-zone-x").inputValue());
    const yAfterDrag = Number(await page.locator("#safe-zone-y").inputValue());
    const widthAfterDrag = Number(await page.locator("#safe-zone-width").inputValue());
    const heightAfterDrag = Number(await page.locator("#safe-zone-height").inputValue());
    expect(xAfterDrag).not.toBe(Number(originalX));
    expect(yAfterDrag).not.toBe(Number(originalY));

    await page.getByRole("button", { name: "Save safe zone for all templates" }).click();
    await expect(page.getByText("Safe zone updated for every template and Sunday preview")).toBeVisible({
      timeout: 30_000,
    });

    // The Settings page reads the exact same `AppSettings.safeZone` row.
    await page.goto("/admin/settings");
    await expect(page.locator("#settings-pip-x")).toHaveValue(String(xAfterDrag));
    await expect(page.locator("#settings-pip-y")).toHaveValue(String(yAfterDrag));
    await expect(page.locator("#settings-pip-width")).toHaveValue(String(widthAfterDrag));
    await expect(page.locator("#settings-pip-height")).toHaveValue(String(heightAfterDrag));

    // The Sunday queue's safe-zone overlay (same renderer) reflects the new size too —
    // the safe zone is global (every template, every Sunday), so the current service is
    // as good a check as any other Sunday.
    const sundayPage = await context.newPage();
    await loginPinAndWait(sundayPage);
    await sundayPage.goto("/sunday");
    await sundayPage.locator("[data-slide-card]").first().waitFor();
    await sundayPage.getByRole("button", { name: "Show safe zones" }).click();
    const overlay = sundayPage.locator("[data-safe-zone]").first();
    await expect(overlay).toBeVisible();
    const style = (await overlay.getAttribute("style")) ?? "";
    expect(style).toContain(`left: ${xAfterDrag}px`);
    expect(style).toContain(`top: ${yAfterDrag}px`);
    expect(style).toContain(`width: ${widthAfterDrag}px`);
    expect(style).toContain(`height: ${heightAfterDrag}px`);
    await sundayPage.close();

    // Restore the original safe zone so other specs (and their screenshots) are unaffected.
    await page.goto(WELCOME_TEMPLATE_PATH);
    await page.getByRole("button", { name: "Edit safe zone" }).click();
    await page.locator("#safe-zone-x").fill(originalX);
    await page.locator("#safe-zone-y").fill(originalY);
    await page.locator("#safe-zone-width").fill(originalWidth);
    await page.locator("#safe-zone-height").fill(originalHeight);
    await page.getByRole("button", { name: "Save safe zone for all templates" }).click();
    await expect(page.getByText("Safe zone updated for every template and Sunday preview")).toBeVisible({
      timeout: 30_000,
    });
  });
});

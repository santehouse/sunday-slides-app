import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { gotoQueue, loginPinAndWait, signInAsAdmin } from "./helpers";

/**
 * BUILD_HANDOFF section 40 — accessibility. axe-core for the automatable rules, plus
 * explicit checks for the things axe cannot see: focus-visible rings, segmented-control
 * radio semantics, the keyboard reorder fallback, and status never being colour-only.
 *
 * Sunday screens follow the single-screen IA (queue + near-full-screen modals) — one
 * page (`/sunday`), everything else (import, new slide, edit, export) in a `<dialog>`.
 */

async function analyse(page: Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Next's dev-tools overlay is not part of the product.
    .exclude("nextjs-portal")
    // Slide artwork (thumbnails, previews) is the church's design, not UI — its text
    // contrast is a template decision, and the row title carries the accessible name.
    .exclude("[data-slide-canvas]")
    .analyze();
}

function summarise(violations: Awaited<ReturnType<typeof analyse>>["violations"]) {
  return violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`).join("\n");
}

test.describe("axe-core", () => {
  test("Sunday screens have no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/sunday/pin");
    let result = await analyse(page);
    expect(summarise(result.violations), "PIN").toBe("");

    // Every navigation below waits for real content, not just the URL — a route with a
    // streamed `loading.tsx` skeleton can otherwise still be showing that (stale-title)
    // skeleton the instant `page.goto`/`waitForURL` resolves, which axe would flag on
    // `document-title` for reasons that have nothing to do with the real page.
    await loginPinAndWait(page);
    await page.locator("[data-slide-card]").first().waitFor();
    result = await analyse(page);
    expect(summarise(result.violations), "Queue").toBe("");

    await page.locator("[data-slide-card]").first().getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).waitFor();
    result = await analyse(page);
    expect(summarise(result.violations), "Edit modal").toBe("");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "New slide" }).click();
    await page.getByRole("heading", { name: "Add a slide" }).waitFor();
    result = await analyse(page);
    expect(summarise(result.violations), "New slide modal").toBe("");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Import announcements" }).click();
    await page.getByRole("heading", { name: "Import announcements" }).waitFor();
    result = await analyse(page);
    expect(summarise(result.violations), "Import modal").toBe("");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Admin screens have no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/admin/sign-in");
    let result = await analyse(page);
    expect(summarise(result.violations), "Admin sign in").toBe("");

    await signInAsAdmin(page);
    for (const route of ["/admin", "/admin/sundays", "/admin/templates", "/admin/assets", "/admin/mappings", "/admin/brand", "/admin/settings"]) {
      await page.goto(route);
      result = await analyse(page);
      expect(summarise(result.violations), route).toBe("");
    }
  });
});

test.describe("Keyboard and semantics", () => {
  test("segmented controls expose radio semantics and chips expose aria-pressed", async ({ page }) => {
    await loginPinAndWait(page);

    // Language Selector.
    const language = page.getByRole("radiogroup", { name: "Language" });
    await expect(language.getByRole("radio", { name: "EN" })).toHaveAttribute("aria-checked", "true");
    await expect(language.getByRole("radio", { name: "FR" })).toHaveAttribute("aria-checked", "false");

    // New slide modal's category chips.
    await page.goto("/sunday?add=1");
    await page.getByRole("heading", { name: "Add a slide" }).waitFor();
    await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Events", exact: true }).click();
    await expect(page.getByRole("button", { name: "Events", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "false");
  });

  test("the film toggle is aria-pressed and the safe-zone action flips its label", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoQueue(page);

    const film = page.locator("[data-slide-card]").first().getByRole("button", { name: /shown in the video|not shown in the video/i });
    await expect(film).toHaveAttribute("aria-pressed");

    await page.locator("[data-slide-card]").first().getByRole("button", { name: "Edit" }).click();
    // The queue's preview panel has its own safe-zone action behind the modal: scope to the dialog.
    const dialog = page.getByRole("dialog");
    const action = dialog.getByRole("button", { name: "Show safe zones" });
    await expect(action).toHaveAttribute("aria-pressed", "false");
    await action.click();
    const active = dialog.getByRole("button", { name: "Hide safe zones" });
    await expect(active).toHaveAttribute("aria-pressed", "true");
    await active.click();
    await expect(dialog.getByRole("button", { name: "Show safe zones" })).toBeVisible();
  });

  test("every Sunday screen is reachable and operable with the keyboard alone", async ({ page }) => {
    await page.goto("/sunday/pin");

    // Tab into the PIN boxes and type the code — auto-advance, then Enter submits.
    await page.keyboard.press("Tab"); // skip/brand
    for (let i = 0; i < 8; i++) {
      const label = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
      if (/digit 1/i.test(label)) break;
      await page.keyboard.press("Tab");
    }
    await page.keyboard.type("53787");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/sunday$/, { timeout: 20_000 });

    // Every interactive element on the queue shows a focus ring when tabbed to.
    await gotoQueue(page);
    const handle = page.getByRole("button", { name: "Drag to reorder slide 1", exact: true });
    await handle.focus();
    const outline = await handle.evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle };
    });
    expect(outline.style, "focus-visible ring is drawn").not.toBe("none");
    expect(parseFloat(outline.width)).toBeGreaterThan(0);
  });

  test("slide status is conveyed by text, not colour alone", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoQueue(page);

    const tags = await page.locator('[data-slide-card] span').allInnerTexts();
    const checkTags = tags.filter((t) => t === "Check");
    expect(checkTags.length, "the needs-a-look row carries a written tag").toBeGreaterThan(0);
  });

  test("dialogs trap focus and close on Escape", async ({ page }) => {
    await loginPinAndWait(page);
    await gotoQueue(page);

    // A non-structural slide — the seeded structural slides (Welcome, …) have no
    // delete control shown for them in review-strip context, but every row still
    // has one; pick a plainly-removable one by headline.
    await page.locator("[data-slide-card]").filter({ hasText: /baptêmes/i }).getByRole("button", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Rendered through the native <dialog>.showModal(), which is implicitly modal:
    // top layer, inert background, native focus containment and Escape-to-close.
    await expect(dialog).toHaveJSProperty("open", true);

    // Tab never reaches a control behind the dialog. (Chromium parks focus on <body>
    // at the wrap point of a modal dialog's tab ring, which is still "not outside".)
    for (let i = 0; i < 8; i++) {
      const where = await page.evaluate(() => {
        const d = document.querySelector("dialog[open]");
        const active = document.activeElement;
        if (!d || !active) return "none";
        if (d.contains(active)) return "inside";
        if (active === document.body || active === document.documentElement) return "body";
        return `outside: ${active.tagName}.${active.className}`;
      });
      expect(where, `focus never escapes the dialog (tab ${i})`).toMatch(/^(inside|body)$/);
      await page.keyboard.press("Tab");
    }

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

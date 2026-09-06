import { test, expect } from "@playwright/test";
import { DEMO_SUNDAY_DATE, loginPin } from "./helpers";

/**
 * Simplified Sunday IA — Step 2 ("Check slides") is the default screen after PIN
 * access, and the 3-step stepper (Run sheet / Check slides / Download) replaces the
 * old tab strip. The demo Sunday (2026-09-06) has 8 seeded slides, one of which
 * ("Veillée des hommes") is `needs_review`.
 */

test.describe("PIN access lands on Step 2", () => {
  test("shows the checklist and all 8 demo slides", async ({ page }) => {
    await loginPin(page);
    await expect(page).toHaveURL(new RegExp(`/sunday/${DEMO_SUNDAY_DATE}$`));

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sunday, September 6");

    // One seeded needs_review slide surfaces as a checklist row with a plain-language reason.
    await expect(page.getByRole("heading", { name: "1 thing to check" })).toBeVisible();
    const row = page.locator("[data-checklist-row]").filter({ hasText: /veillée des hommes/i });
    await expect(row).toContainText("The computer wasn’t sure which design to use");
    await expect(row.getByRole("button", { name: "Check" })).toBeVisible();

    await expect(page.locator("[data-slide-card]")).toHaveCount(8);
  });

  test("the Check button on a checklist row selects that slide in the edit panel", async ({ page }) => {
    await loginPin(page);
    const row = page.locator("[data-checklist-row]").filter({ hasText: /veillée des hommes/i });
    await row.getByRole("button", { name: "Check" }).click();

    await expect(page).toHaveURL(/\?slide=/);
    await expect(page.getByRole("heading", { name: /veillée des hommes/i })).toBeVisible();
  });
});

test.describe("Stepper statuses", () => {
  test("EN: run sheet used, one thing to check, download ready", async ({ page }) => {
    await loginPin(page);
    const stepper = page.getByRole("navigation");

    const step1 = stepper.getByRole("link", { name: /Run sheet/ });
    await expect(step1).toContainText("Using 260906.docx");

    const step2 = stepper.getByRole("link", { name: /Check slides/ });
    await expect(step2).toHaveAttribute("aria-current", "step");
    await expect(step2).toContainText("1 thing to check");

    const step3 = stepper.getByRole("link", { name: /Download/ });
    await expect(step3).toContainText("Ready");
  });

  test("FR: labels and statuses are translated", async ({ page }) => {
    await loginPin(page, { locale: "fr" });
    const stepper = page.getByRole("navigation");

    await expect(stepper.getByRole("link", { name: /Feuille de déroulement/ })).toContainText("Utilise 260906.docx");
    await expect(stepper.getByRole("link", { name: /Vérifier les diapositives/ })).toContainText("1 chose à vérifier");
    await expect(stepper.getByRole("link", { name: /^Télécharger/ })).toContainText("Prêt");
  });
});

import type { Page } from "@playwright/test";

export const SUNDAY_PIN = "53787";
export const DEMO_SUNDAY_DATE = "2026-09-06";

/** Fills the shared PIN and submits, landing on `/sunday/[date]` (Step 2, "Check slides"). */
export async function loginPin(page: Page, opts: { locale?: "en" | "fr" } = {}) {
  const prefix = opts.locale === "fr" ? "/fr" : "";
  await page.goto(`${prefix}/sunday/pin`);

  const inputs = page.locator('input[inputmode="numeric"]');
  for (let i = 0; i < SUNDAY_PIN.length; i++) {
    await inputs.nth(i).fill(SUNDAY_PIN[i]!);
  }

  await page.getByRole("button", { name: /open sunday|ouvrir la présentation/i }).click();
  await page.waitForURL(/\/(fr\/)?sunday\/\d{4}-\d{2}-\d{2}$/);
}

export async function loginPinAndWait(page: Page) {
  await loginPin(page);
  await page.locator("[data-slide-card]").first().waitFor();
}

export async function gotoCheckSlides(page: Page, date = DEMO_SUNDAY_DATE) {
  await page.goto(`/sunday/${date}`);
  await page.locator("[data-slide-card]").first().waitFor();
}

import type { APIRequestContext, Page } from "@playwright/test";

export const SUNDAY_PIN = "53787";
export const DEMO_SUNDAY_DATE = "2026-09-06";

/** Fills the shared PIN and submits, landing on `/sunday/[date]`. */
export async function loginPin(page: Page, pin = SUNDAY_PIN) {
  await page.goto("/sunday/pin");
  const inputs = page.locator('input[inputmode="numeric"]');
  for (let i = 0; i < pin.length; i++) await inputs.nth(i).fill(pin[i]!);
  await page.getByRole("button", { name: /open sunday/i }).click();
}

export async function loginPinAndWait(page: Page) {
  await loginPin(page);
  await page.waitForURL(/\/sunday\/\d{4}-\d{2}-\d{2}$/);
}

export async function gotoFlow(page: Page, date = DEMO_SUNDAY_DATE) {
  await page.goto(`/sunday/${date}/flow`);
  await page.locator("[data-slide-card]").first().waitFor();
}

export async function signInAsAdmin(page: Page, path = "/admin/sign-in") {
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill("admin@example.org");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/admin");
}

/** Slide-flow card titles, in Sunday Flow order. */
export async function flowTitles(page: Page): Promise<string[]> {
  return page.locator("[data-slide-card] .text-label").filter({ hasText: /^\d\d / }).allInnerTexts();
}

export async function apiJson(request: APIRequestContext, url: string) {
  const res = await request.get(url);
  return { status: res.status(), body: await res.json().catch(() => null) };
}

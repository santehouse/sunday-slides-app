import type { APIRequestContext, Page } from "@playwright/test";

export const SUNDAY_PIN = "53787";
export const DEMO_SUNDAY_DATE = "2026-09-06";

/** Fills the shared PIN and submits, landing on `/sunday` (the single queue screen). */
export async function loginPin(page: Page, pin = SUNDAY_PIN) {
  await page.goto("/sunday/pin");
  const inputs = page.locator('input[inputmode="numeric"]');
  for (let i = 0; i < pin.length; i++) await inputs.nth(i).fill(pin[i]!);
  await page.getByRole("button", { name: /open sunday/i }).click();
}

export async function loginPinAndWait(page: Page) {
  await loginPin(page);
  await page.waitForURL(/\/sunday$/);
}

/** Navigates to the queue screen and waits for the (mock demo) slides to render. */
export async function gotoQueue(page: Page) {
  await page.goto("/sunday");
  await page.locator("[data-slide-card]").first().waitFor();
}

export async function signInAsAdmin(page: Page, path = "/admin/sign-in") {
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill("admin@example.org");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/admin");
}

/** Queue row titles ("01 Welcome", ...), in queue order. */
export async function queueTitles(page: Page): Promise<string[]> {
  return page.locator("[data-slide-card]").evaluateAll((cards) =>
    cards.map((c) => {
      const number = c.querySelector("[data-slide-select] > .text-caption")?.textContent?.trim() ?? "";
      const headline = c.querySelector(".text-label")?.textContent?.trim() ?? "";
      return `${number} ${headline}`.trim();
    }),
  );
}

export async function apiJson(request: APIRequestContext, url: string) {
  const res = await request.get(url);
  return { status: res.status(), body: await res.json().catch(() => null) };
}

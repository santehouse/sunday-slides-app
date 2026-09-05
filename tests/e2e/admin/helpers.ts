import type { Page } from "@playwright/test";

/**
 * Signs in through the real Admin sign-in form. Mock mode (`CP_MOCK_DATA=1`,
 * set by `playwright.config.ts`'s `webServer`) accepts any email/password.
 */
export async function signInAsAdmin(page: Page, path = "/admin/sign-in") {
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill("admin@example.org");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin");
}

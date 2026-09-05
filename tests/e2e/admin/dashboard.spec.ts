import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers";

const PROTECTED_ROUTES = [
  "/admin",
  "/admin/sundays",
  "/admin/templates",
  "/admin/assets",
  "/admin/mappings",
  "/admin/brand",
  "/admin/settings",
];

test.describe("Admin sign-in and dashboard", () => {
  test("signs in (mock) and renders dashboard stats", async ({ page }) => {
    await signInAsAdmin(page);
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
    await expect(page.getByText("Published templates")).toBeVisible();
    await expect(page.getByText("Published assets")).toBeVisible();
    await expect(page.getByText("Announcement mappings")).toBeVisible();
    await expect(page.getByText("System health")).toBeVisible();
  });

  test("renders the dashboard title in French", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/fr/admin");
    await expect(page.getByRole("heading", { name: "Tableau de bord admin" })).toBeVisible();
  });

  for (const route of PROTECTED_ROUTES) {
    test(`redirects ${route} to sign-in when not signed in`, async ({ page, context }) => {
      await context.clearCookies();
      await page.goto(route);
      await page.waitForURL("**/admin/sign-in");
      await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
    });
  }
});

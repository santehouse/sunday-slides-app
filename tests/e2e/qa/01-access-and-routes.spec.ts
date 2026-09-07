import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { DEMO_SUNDAY_DATE, loginPin, loginPinAndWait, signInAsAdmin, SUNDAY_PIN } from "./helpers";

/** A fresh rate-limit bucket per run — the limiter keys on client IP over a 10-minute window. */
function isolatedIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 250) + 2}`;
}

/**
 * BUILD_HANDOFF section 48 — Sunday PIN, route gating and the public API surface.
 * Runs against `CP_MOCK_DATA=1`.
 */

test.describe("Sunday PIN access", () => {
  test("a valid PIN opens the Sunday queue and sets an httpOnly session cookie", async ({ page, context }) => {
    await loginPinAndWait(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("This service");

    const cookie = (await context.cookies()).find((c) => c.name.startsWith("cp_sunday"));
    expect(cookie, "Sunday session cookie must exist").toBeTruthy();
    expect(cookie!.httpOnly, "Sunday session cookie must be httpOnly").toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
  });

  test("a wrong PIN shows a translated error and stays on the PIN screen", async ({ browser }) => {
    // Own IP bucket: failed attempts count toward the rate limit, and every other spec
    // in this shared mock-data process needs the PIN to keep working.
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": isolatedIp() } });
    const page = await context.newPage();
    await loginPin(page, "11111");
    await expect(page).toHaveURL(/\/sunday\/pin$/);
    await expect(page.locator('main [role="alert"]')).toContainText("That PIN isn’t right. Try again.");
    await context.close();
  });

  test("repeated wrong PINs trip the rate limit", async ({ browser }) => {
    // The limiter buckets by client IP. Use a dedicated forwarded-for so tripping it here
    // never locks the shared bucket the rest of the suite signs in through.
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": isolatedIp() } });
    const page = await context.newPage();
    await page.goto("/sunday/pin");

    const digits = page.locator('input[inputmode="numeric"]');
    const submit = page.getByRole("button", { name: /open sunday/i });
    async function attempt(pin: string) {
      for (let i = 0; i < pin.length; i++) await digits.nth(i).fill(pin[i]!);
      await submit.click();
      await expect(page.locator('main [role="alert"]')).toBeVisible();
    }

    // 5 failures inside the 10-minute window is the documented threshold.
    for (let i = 0; i < 5; i++) {
      await attempt("11111");
      await expect(page.locator('main [role="alert"]')).toContainText("That PIN isn’t right. Try again.");
    }

    await attempt("11111");
    await expect(page.locator('main [role="alert"]')).toContainText("Too many attempts");

    // The correct PIN is refused too while the limiter is engaged.
    await attempt(SUNDAY_PIN);
    await expect(page).toHaveURL(/\/sunday\/pin$/);
    await expect(page.locator('main [role="alert"]')).toContainText("Too many attempts");

    await context.close();
  });
});

test.describe("Unauthenticated gating", () => {
  for (const path of [
    "/sunday",
    `/sunday/${DEMO_SUNDAY_DATE}`,
    `/sunday/${DEMO_SUNDAY_DATE}/run-sheet`,
    `/sunday/${DEMO_SUNDAY_DATE}/flow`,
  ]) {
    test(`${path} redirects to the PIN screen`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sunday\/pin$/);
    });
  }

  for (const path of ["/admin", "/admin/sundays", "/admin/templates", "/admin/assets", "/admin/mappings", "/admin/brand", "/admin/settings"]) {
    test(`${path} redirects to admin sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/sign-in/);
    });
  }
});

test.describe("API surface", () => {
  test("/api/health reports mock mode", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mockMode).toBe(true);
  });

  test("/api/export without a session is 401", async ({ request }) => {
    const res = await request.post("/api/export", {
      data: { sundayId: "x", format: "jpg", scope: "all" },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  test("/api/render/preview without a session is 401", async ({ request }) => {
    // Renders arbitrary input through headless Chromium — never anonymous.
    const res = await request.post("/api/render/preview", { data: { input: {} } });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  test("/api/cron/maintenance without the CRON_SECRET is 401", async ({ request }) => {
    const res = await request.get("/api/cron/maintenance");
    expect(res.status()).toBe(401);
  });

  test("/api/inbound/resend accepts an unsigned payload in dev and dedupes by event id", async ({ request }) => {
    const docx = readFileSync(join(process.cwd(), "tests/fixtures/run-sheets/260906.docx")).toString("base64");
    const eventId = `qa-inbound-${Date.now()}`;
    const payload = {
      type: "email.received",
      data: {
        email_id: eventId,
        subject: "Run sheet for Sunday",
        text: "Voici la feuille de déroulement.",
        // A Monday whose "next Sunday" (2026-07-12) isn't any seeded or spec-owned Sunday —
        // this only tests dedup-by-event-id, so it must not leave a "latest run sheet" on a
        // date another spec (e.g. the Simplified Sunday IA stepper specs) asserts on.
        created_at: "2026-07-06T12:00:00.000Z",
        attachments: [
          {
            id: "att-1",
            // Distinct name: the Sunday Import specs assert on the seeded "260906.docx" rows,
            // and this unopened copy must never be mistaken for one of them.
            filename: "qa-inbound.docx",
            content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            content: docx,
          },
        ],
      },
    };

    const first = await request.post("/api/inbound/resend", { data: payload });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.ok).toBe(true);
    expect(firstBody.runSheetId, "a run sheet is created from the attachment").toBeTruthy();

    // Same Resend event id again: dedupe must return the existing record, not a new one.
    const second = await request.post("/api/inbound/resend", { data: payload });
    expect(second.status()).toBe(200);
    expect((await second.json()).runSheetId).toBe(firstBody.runSheetId);
  });
});

test.describe("Admin auth", () => {
  test("signs in, persists locale across reload, and signs out", async ({ page }) => {
    await signInAsAdmin(page);
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();

    // Locale switch persists to the account and survives a reload.
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("radio", { name: "FR" }).click();
    await page.waitForURL("**/fr/admin");
    await page.reload();
    await expect(page).toHaveURL(/\/fr\/admin$/);
    await expect(page.getByRole("heading", { name: "Tableau de bord admin" })).toBeVisible();

    await page.getByRole("button", { name: "Menu du compte" }).click();
    await page.getByRole("menuitem", { name: /se déconnecter/i }).click();
    await page.waitForURL(/\/admin\/sign-in/);

    // Restore EN for the rest of the suite.
    await page.goto("/admin/sign-in");
  });
});

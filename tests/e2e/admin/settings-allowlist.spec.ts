import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers";

/**
 * Inbound sender allowlist: saved from Settings, enforced by the Resend webhook. The mock
 * store is shared by every spec in the dev-server process, so the allowlist is cleared
 * again at the end (the qa/01 inbound spec posts without a From header and relies on
 * "empty = everyone").
 */
test("allowed senders are saved, enforced by the inbound webhook, and rejections get a reply attempt", async ({
  page,
  request,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  const field = page.getByLabel("Allowed senders");
  await field.fill("Pastor@EAJC.test\nnot-an-address");
  await expect(page.getByText("Not an address or domain: not-an-address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();

  await field.fill("Pastor@EAJC.test\neajc.test");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  // Normalised (lower-case, domain gets its @) and persisted across a reload.
  await page.reload();
  await expect(page.getByLabel("Allowed senders")).toHaveValue("pastor@eajc.test\n@eajc.test");

  const base = {
    type: "email.received",
    text: "Bonjour",
    created_at: "2026-07-06T12:00:00Z",
  };

  // A stranger: dropped silently, no run sheet, no reply.
  const stranger = await request.post("/api/inbound/resend", {
    data: { ...base, data: { email_id: `allow-stranger-${Date.now()}`, from: "Someone <someone@else.test>", subject: "hi", attachments: [] } },
  });
  expect(stranger.status()).toBe(200);
  expect(await stranger.json()).toEqual({ ok: true });

  // An allowed sender (by domain) with no usable attachment: rejected, and a reply is
  // attempted (the test server has no Resend key, so the attempt reports as skipped).
  const noFile = await request.post("/api/inbound/resend", {
    data: {
      ...base,
      data: {
        email_id: `allow-nofile-${Date.now()}`,
        from: "Secretary <secretary@eajc.test>",
        subject: "Annonces",
        attachments: [{ id: "x", filename: "photo.jpg", content_type: "image/jpeg" }],
      },
    },
  });
  expect(noFile.status()).toBe(200);
  expect(await noFile.json()).toEqual({ ok: true, rejected: "unsupported", autoReply: "skipped_not_configured" });

  // Restore the shared mock store: empty allowlist = everyone.
  await page.getByLabel("Allowed senders").fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Allowed senders")).toHaveValue("");
});

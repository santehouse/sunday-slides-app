import { describe, expect, it } from "vitest";
import { Webhook, WebhookVerificationError } from "svix";
import {
  pickRunSheetAttachment,
  resolveTargetSundayDate,
  sanitizeFilename,
  verifyResendWebhook,
  type InboundAttachment,
} from "@/lib/resend/inbound";

const SECRET = "whsec_MfKQ9r8GwOuP6dSf4TRTuS9CTJz5uCsl";

function signedHeaders(body: string, secret = SECRET) {
  const webhook = new Webhook(secret);
  const id = "msg_test_123";
  const timestamp = new Date();
  const signature = webhook.sign(id, timestamp, body);
  return {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  };
}

describe("verifyResendWebhook", () => {
  it("returns the parsed payload for a validly-signed request", () => {
    const body = JSON.stringify({ type: "email.received", data: { subject: "Run sheet" } });
    const headers = signedHeaders(body);
    const result = verifyResendWebhook(body, headers, SECRET);
    expect(result).toEqual({ type: "email.received", data: { subject: "Run sheet" } });
  });

  it("throws on a bad signature", () => {
    const body = JSON.stringify({ type: "email.received" });
    const headers = signedHeaders(body);
    headers["svix-signature"] = "v1,not-a-real-signature";
    expect(() => verifyResendWebhook(body, headers, SECRET)).toThrow(WebhookVerificationError);
  });

  it("throws when the secret doesn't match", () => {
    const body = JSON.stringify({ type: "email.received" });
    const headers = signedHeaders(body, SECRET);
    const otherSecret = "whsec_completelyDifferentSecretValue12345";
    expect(() => verifyResendWebhook(body, headers, otherSecret)).toThrow(WebhookVerificationError);
  });

  it("throws when required headers are missing", () => {
    const body = JSON.stringify({ type: "email.received" });
    expect(() => verifyResendWebhook(body, {}, SECRET)).toThrow(WebhookVerificationError);
  });

  it("throws when the payload was tampered with after signing", () => {
    const body = JSON.stringify({ type: "email.received" });
    const headers = signedHeaders(body);
    const tamperedBody = JSON.stringify({ type: "email.received", extra: "injected" });
    expect(() => verifyResendWebhook(tamperedBody, headers, SECRET)).toThrow(WebhookVerificationError);
  });
});

function attachment(overrides: Partial<InboundAttachment>): InboundAttachment {
  return { filename: "run-sheet.docx", contentType: "application/octet-stream", size: 1024, ...overrides };
}

describe("pickRunSheetAttachment", () => {
  it("picks the single docx attachment", () => {
    const docx = attachment({ filename: "run-sheet.docx" });
    const result = pickRunSheetAttachment([docx]);
    expect(result).toEqual({ ok: true, attachment: docx });
  });

  it("picks the single pdf attachment", () => {
    const pdf = attachment({ filename: "run-sheet.pdf", contentType: "application/pdf" });
    const result = pickRunSheetAttachment([pdf]);
    expect(result).toEqual({ ok: true, attachment: pdf });
  });

  it("prefers docx over pdf when both are present", () => {
    const docx = attachment({ filename: "run-sheet.docx" });
    const pdf = attachment({ filename: "run-sheet.pdf", contentType: "application/pdf" });
    const result = pickRunSheetAttachment([pdf, docx]);
    expect(result).toEqual({ ok: true, attachment: docx });
  });

  it("returns ambiguous when multiple attachments of the winning type exist", () => {
    const docx1 = attachment({ filename: "run-sheet-1.docx" });
    const docx2 = attachment({ filename: "run-sheet-2.docx" });
    const result = pickRunSheetAttachment([docx1, docx2]);
    expect(result.ok).toBe(false);
    if (!result.ok && result.ambiguous) {
      expect(result.candidates).toEqual([docx1, docx2]);
    } else {
      throw new Error("expected an ambiguous result");
    }
  });

  it("returns not-ambiguous / not-ok when nothing supported is attached", () => {
    const image = attachment({ filename: "photo.png", contentType: "image/png" });
    const result = pickRunSheetAttachment([image]);
    expect(result).toEqual({ ok: false, ambiguous: false });
  });

  it("returns not-ambiguous / not-ok for an empty attachment list", () => {
    expect(pickRunSheetAttachment([])).toEqual({ ok: false, ambiguous: false });
  });

  it("detects type by extension when content-type is generic", () => {
    const docx = attachment({ filename: "sheet.docx", contentType: "application/octet-stream" });
    const result = pickRunSheetAttachment([docx]);
    expect(result).toEqual({ ok: true, attachment: docx });
  });
});

describe("sanitizeFilename", () => {
  it("strips path separators, keeping only the base name", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\pastor\\run-sheet.docx")).toBe("run-sheet.docx");
  });

  it("replaces unsafe/control characters", () => {
    expect(sanitizeFilename('bad<>:"|?*name.docx')).toBe("bad_name.docx");
  });

  it("leaves a normal filename untouched", () => {
    expect(sanitizeFilename("260906.docx")).toBe("260906.docx");
    expect(sanitizeFilename("Feuille de route - 6 septembre.docx")).toBe("Feuille de route - 6 septembre.docx");
  });

  it("falls back to a default name when nothing usable remains", () => {
    expect(sanitizeFilename("...")).toBe("attachment");
    expect(sanitizeFilename("")).toBe("attachment");
  });

  it("clamps very long filenames", () => {
    const long = `${"a".repeat(300)}.docx`;
    const result = sanitizeFilename(long);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith(".docx")).toBe(true);
  });
});

describe("resolveTargetSundayDate", () => {
  const TZ = "America/Toronto";

  it("defaults to the next Sunday on/after the received date when no date is mentioned", () => {
    // 2026-09-01 is a Tuesday; next Sunday is 2026-09-06.
    const result = resolveTargetSundayDate("Weekly announcements", "Please see attached.", "2026-09-01T14:00:00Z", TZ);
    expect(result).toBe("2026-09-06");
  });

  it("uses the received date itself when it is already a Sunday", () => {
    const result = resolveTargetSundayDate("Announcements", "See attached.", "2026-09-06T14:00:00Z", TZ);
    expect(result).toBe("2026-09-06");
  });

  it("parses an ISO date in the subject", () => {
    const result = resolveTargetSundayDate("Run sheet 2026-09-06", "body", "2026-08-30T14:00:00Z", TZ);
    expect(result).toBe("2026-09-06");
  });

  it("parses a French 'D month' date in the body", () => {
    const result = resolveTargetSundayDate("Feuille de route", "Pour dimanche le 6 septembre, voici...", "2026-08-30T14:00:00Z", TZ);
    expect(result).toBe("2026-09-06");
  });

  it("parses an English 'Month D' date", () => {
    const result = resolveTargetSundayDate("Run sheet for Sept 6", "body", "2026-08-30T14:00:00Z", TZ);
    expect(result).toBe("2026-09-06");
  });

  it("parses a dd-mm-yy date", () => {
    const result = resolveTargetSundayDate("Run sheet 06-09-26", "body", "2026-08-30T14:00:00Z", TZ);
    expect(result).toBe("2026-09-06");
  });

  it("rolls a non-Sunday explicit date forward to the following Sunday", () => {
    // September 8, 2026 is a Tuesday.
    const result = resolveTargetSundayDate("Run sheet 2026-09-08", "body", "2026-08-30T14:00:00Z", TZ);
    expect(result).toBe("2026-09-13");
  });

  it("infers the year from the received date when none is given", () => {
    const result = resolveTargetSundayDate("Feuille de route", "le 6 septembre", "2026-08-30T14:00:00Z", TZ);
    expect(result).toBe("2026-09-06");
  });
});

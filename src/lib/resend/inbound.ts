/**
 * Resend inbound email webhook helpers (sections 16/32 of
 * BUILD_HANDOFF.md): signature verification, attachment selection,
 * filename sanitization, and target-Sunday resolution.
 *
 * Deliberately does NOT `import "server-only"` — see the note at the top of
 * `src/lib/openai/client.ts` for why: this module must stay importable from
 * Vitest, and the webhook secret is only ever passed in by the caller (the
 * route handler), never read from `process.env` here.
 */

import { Webhook } from "svix";

// --- Signature verification --------------------------------------------------------------------

/**
 * Verifies a Resend (svix-signed) inbound webhook request. Throws
 * `WebhookVerificationError` (from `svix`) if the signature, timestamp, or
 * headers are invalid. On success, returns the JSON-parsed body — note that
 * `svix`'s own `Webhook.verify` always requests `jsonParse: false`
 * internally and returns `undefined` on success, so parsing is done here.
 */
export function verifyResendWebhook(rawBody: string, headers: Record<string, string>, secret: string): unknown {
  const webhook = new Webhook(secret);
  webhook.verify(rawBody, headers);
  return rawBody === "" ? undefined : JSON.parse(rawBody);
}

// --- Attachment selection ------------------------------------------------------------------------

export interface InboundAttachment {
  filename: string;
  contentType: string;
  size: number;
  /** Base64-encoded content, when provided by the webhook payload. */
  content?: string;
}

export type PickRunSheetAttachmentResult =
  | { ok: true; attachment: InboundAttachment }
  | { ok: false; ambiguous: true; candidates: InboundAttachment[] }
  | { ok: false; ambiguous: false };

type SupportedType = "docx" | "pdf";

function detectAttachmentType(attachment: InboundAttachment): SupportedType | null {
  const contentType = attachment.contentType.toLowerCase();
  const extension = attachment.filename.toLowerCase().split(".").pop();

  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === "docx") {
    return "docx";
  }
  if (contentType === "application/pdf" || extension === "pdf") {
    return "pdf";
  }
  return null;
}

/**
 * Picks the single run-sheet attachment from an inbound email: prefers
 * `.docx` over `.pdf` when both are present; if the winning type has more
 * than one candidate, the caller gets an `ambiguous` result (for Admin
 * review) rather than a silent guess.
 */
export function pickRunSheetAttachment(attachments: InboundAttachment[]): PickRunSheetAttachmentResult {
  const docx = attachments.filter((a) => detectAttachmentType(a) === "docx");
  const pdf = attachments.filter((a) => detectAttachmentType(a) === "pdf");

  const chosen = docx.length > 0 ? docx : pdf;

  if (chosen.length === 0) {
    return { ok: false, ambiguous: false };
  }
  if (chosen.length > 1) {
    return { ok: false, ambiguous: true, candidates: chosen };
  }
  return { ok: true, attachment: chosen[0] };
}

// --- Filename sanitization -----------------------------------------------------------------------

const UNSAFE_FILENAME_CHARS = /[\u0000-\u001f\u007f<>:"|?*\\/]+/g;
const MAX_FILENAME_LENGTH = 200;

/** Strips path separators/control characters and clamps length so a filename is safe to store/serve. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const cleaned = base.normalize("NFC").replace(UNSAFE_FILENAME_CHARS, "_").trim();
  const safe = cleaned.replace(/^\.+/, "") || "attachment";
  return safe.length > MAX_FILENAME_LENGTH ? safe.slice(safe.length - MAX_FILENAME_LENGTH) : safe;
}

// --- Target Sunday resolution ----------------------------------------------------------------------

const FR_MONTHS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];

const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractDateFromText(text: string, referenceYear: number): Date | null {
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  const shortMatch = text.match(/\b(\d{2})-(\d{2})-(\d{2})\b/);
  if (shortMatch) {
    const [, d, m, y] = shortMatch;
    return new Date(Date.UTC(2000 + Number(y), Number(m) - 1, Number(d)));
  }

  const normalized = stripAccents(text.toLowerCase());

  const frRegex = new RegExp(`\\b(\\d{1,2})\\s+(${FR_MONTHS.join("|")})\\b(?:\\s+(\\d{4}))?`, "i");
  const frMatch = normalized.match(frRegex);
  if (frMatch) {
    const day = Number(frMatch[1]);
    const monthIndex = FR_MONTHS.indexOf(frMatch[2]);
    const year = frMatch[3] ? Number(frMatch[3]) : referenceYear;
    return new Date(Date.UTC(year, monthIndex, day));
  }

  const enRegex = new RegExp(`\\b(${EN_MONTHS.join("|")})[a-z]*\\.?\\s+(\\d{1,2})\\b(?:,?\\s+(\\d{4}))?`, "i");
  const enMatch = normalized.match(enRegex);
  if (enMatch) {
    const monthIndex = EN_MONTHS.indexOf(enMatch[1]);
    const day = Number(enMatch[2]);
    const year = enMatch[3] ? Number(enMatch[3]) : referenceYear;
    return new Date(Date.UTC(year, monthIndex, day));
  }

  return null;
}

/** Returns the calendar date (UTC midnight) as observed in `timeZone`. */
function toZonedDateOnly(date: Date, timeZone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The same UTC-midnight date if it's already a Sunday, otherwise the next Sunday after it. */
function nextSundayOnOrAfter(date: Date): Date {
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday
  const daysToAdd = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  return new Date(date.getTime() + daysToAdd * MS_PER_DAY);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Resolves which Sunday an inbound run sheet email is for: the next Sunday
 * on/after the email's received date, UNLESS the subject/body contains an
 * explicit date (`2026-09-06`, `6 septembre`, `Sept 6`, `06-09-26`), in
 * which case the Sunday of that date's week is used instead.
 */
export function resolveTargetSundayDate(
  emailSubject: string,
  emailBody: string,
  receivedAt: Date | string,
  timezone: string,
): string {
  const received = typeof receivedAt === "string" ? new Date(receivedAt) : receivedAt;
  const receivedLocalDay = toZonedDateOnly(received, timezone);

  const combinedText = `${emailSubject}\n${emailBody}`;
  const explicitDate = extractDateFromText(combinedText, receivedLocalDay.getUTCFullYear());

  const target = explicitDate ? nextSundayOnOrAfter(explicitDate) : nextSundayOnOrAfter(receivedLocalDay);
  return formatIsoDate(target);
}

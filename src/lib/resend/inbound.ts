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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * An explicit date further than this from the received date is treated as noise (a phone
 * number, an old reference, a misread) rather than intent — the email is then filed under
 * the next Sunday after it was received, like an email with no date at all.
 */
const MAX_EXPLICIT_DATE_DRIFT_DAYS = 400;

function utcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject roll-overs such as 31 February.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

/** Of the valid candidates, the one closest to the reference date. */
function closestTo(reference: Date, candidates: Array<Date | null>): Date | null {
  let best: Date | null = null;
  for (const candidate of candidates) {
    if (candidate && (!best || daysBetween(candidate, reference) < daysBetween(best, reference))) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Six-digit dates are the church's filename convention (`260920.docx` = 2026-09-20), but
 * a short numeric date with separators is genuinely ambiguous: `26-09-20` is 2026-09-20
 * (yy-mm-dd) while `06-09-26` is 2026-09-06 (dd-mm-yy). Both readings are tried and the
 * one nearest the received date wins, so a run sheet never lands years away.
 */
function extractDateFromText(text: string, referenceDate: Date): Date | null {
  const isoMatch = text.match(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const date = utcDate(Number(y), Number(m), Number(d));
    if (date) return date;
  }

  const compactLongMatch = text.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
  if (compactLongMatch) {
    const [, y, m, d] = compactLongMatch;
    const date = utcDate(Number(y), Number(m), Number(d));
    if (date) return date;
  }

  const shortMatch = text.match(/\b(\d{2})[-/._](\d{2})[-/._](\d{2})\b/);
  if (shortMatch) {
    const [, a, b, c] = shortMatch.map(Number);
    const date = closestTo(referenceDate, [
      utcDate(2000 + a, b, c), // yy-mm-dd
      utcDate(2000 + c, b, a), // dd-mm-yy
    ]);
    if (date) return date;
  }

  const compactShortMatch = text.match(/\b(\d{2})(\d{2})(\d{2})\b/);
  if (compactShortMatch) {
    const [, y, m, d] = compactShortMatch;
    const date = utcDate(2000 + Number(y), Number(m), Number(d));
    if (date) return date;
  }

  const referenceYear = referenceDate.getUTCFullYear();
  const normalized = stripAccents(text.toLowerCase());

  const frRegex = new RegExp(`\\b(\\d{1,2})\\s+(${FR_MONTHS.join("|")})\\b(?:\\s+(\\d{4}))?`, "i");
  const frMatch = normalized.match(frRegex);
  if (frMatch) {
    const day = Number(frMatch[1]);
    const monthIndex = FR_MONTHS.indexOf(frMatch[2]);
    const year = frMatch[3] ? Number(frMatch[3]) : referenceYear;
    return utcDate(year, monthIndex + 1, day);
  }

  const enRegex = new RegExp(`\\b(${EN_MONTHS.join("|")})[a-z]*\\.?\\s+(\\d{1,2})\\b(?:,?\\s+(\\d{4}))?`, "i");
  const enMatch = normalized.match(enRegex);
  if (enMatch) {
    const monthIndex = EN_MONTHS.indexOf(enMatch[1]);
    const day = Number(enMatch[2]);
    const year = enMatch[3] ? Number(enMatch[3]) : referenceYear;
    return utcDate(year, monthIndex + 1, day);
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
 * explicit date (`2026-09-06`, `6 septembre`, `Sept 6`, `26-09-06`, `260906`), in
 * which case the Sunday of that date's week is used instead. A date more than about a
 * year away from the received date is ignored rather than filing the sheet in the past.
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
  const explicitDate = extractDateFromText(combinedText, receivedLocalDay);
  const usableDate =
    explicitDate && daysBetween(explicitDate, receivedLocalDay) <= MAX_EXPLICIT_DATE_DRIFT_DAYS ? explicitDate : null;

  const target = nextSundayOnOrAfter(usableDate ?? receivedLocalDay);
  return formatIsoDate(target);
}

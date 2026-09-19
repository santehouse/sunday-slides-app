/**
 * Inbound sender allowlist — pure helpers shared by the admin Settings form (parsing what
 * the admin typed) and the Resend webhook (deciding whether to accept an email).
 *
 * An entry is either a full address (`pastor@eajc.org`) or a domain (`@eajc.org` or
 * `eajc.org`). Matching is case-insensitive. An EMPTY allowlist accepts every sender.
 */

const ADDRESS_ENTRY = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const DOMAIN_ENTRY = /^@?[^\s@<>,;]+\.[^\s@<>,;]+$/;

/** Pulls the bare address out of a `From` header value such as `Jane Doe <jane@x.org>`. */
export function extractEmailAddress(from: string): string {
  const angle = from.match(/<([^<>]+)>/);
  const raw = (angle ? angle[1] : from).trim();
  return raw.toLowerCase();
}

/** Normalises one admin-typed entry; returns null when it is neither an address nor a domain. */
export function normalizeAllowedSender(entry: string): string | null {
  const value = entry.trim().toLowerCase();
  if (!value) return null;
  if (ADDRESS_ENTRY.test(value)) return value;
  if (DOMAIN_ENTRY.test(value)) return value.startsWith("@") ? value : `@${value}`;
  return null;
}

export interface ParsedAllowedSenders {
  entries: string[];
  invalid: string[];
}

/**
 * Splits a textarea's contents (one entry per line; commas, semicolons and whitespace also
 * separate) into normalised, de-duplicated entries plus whatever could not be understood.
 */
export function parseAllowedSenders(text: string): ParsedAllowedSenders {
  const entries: string[] = [];
  const invalid: string[] = [];
  for (const piece of text.split(/[\n,;\s]+/)) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const normalized = normalizeAllowedSender(trimmed);
    if (!normalized) {
      invalid.push(trimmed);
    } else if (!entries.includes(normalized)) {
      entries.push(normalized);
    }
  }
  return { entries, invalid };
}

/** True when the allowlist is empty or the sender's address / domain is listed. */
export function isSenderAllowed(from: string, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return true;
  const address = extractEmailAddress(from);
  const at = address.lastIndexOf("@");
  if (at < 0) return false;
  const domain = address.slice(at); // includes the leading "@"
  return allowlist.some((entry) => {
    const normalized = entry.toLowerCase();
    return normalized.startsWith("@") ? normalized === domain : normalized === address;
  });
}

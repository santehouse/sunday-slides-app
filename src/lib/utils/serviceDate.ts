/**
 * Helpers for `YYYY-MM-DD` service dates (`sundays.service_date`).
 *
 * These values are calendar dates, not instants. Formatting them with
 * `new Date("2026-09-06T00:00:00")` breaks as soon as the runtime timezone and the
 * display timezone differ: on a UTC server rendered through `America/Toronto`
 * (`next-intl`'s configured `timeZone`) that instant lands on Sep 5 20:00, so the UI
 * printed "Saturday, September 5" for the Sunday deck. Anchoring at 12:00 UTC keeps the
 * calendar day stable for every timezone within ±12h.
 */

/** `YYYY-MM-DD` → a `Date` that formats as that calendar day in any church timezone. */
export function serviceDateToDate(serviceDate: string): Date {
  return new Date(`${serviceDate}T12:00:00Z`);
}

/** Formats "now" as a `YYYY-MM-DD` date string in `timezone` (Intl, no library dependency). */
export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** True for a `YYYY-MM-DD` string that is a real calendar date falling on a Sunday. */
export function isSundayDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value) && d.getUTCDay() === 0;
}

/**
 * The service date of the coming Sunday: `date` itself when it already is a Sunday,
 * otherwise the next Sunday after it. This is what "the current service" means for the
 * Sunday team — a Sunday created further ahead (a special event, a pre-planned deck)
 * must never become the current queue.
 */
export function nextSundayOnOrAfter(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`nextSundayOnOrAfter: invalid date "${date}"`);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

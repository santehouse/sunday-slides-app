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

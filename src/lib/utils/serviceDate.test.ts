import { describe, expect, it } from "vitest";
import { isSundayDate, nextSundayOnOrAfter } from "./serviceDate";

describe("nextSundayOnOrAfter", () => {
  it("returns the date itself when it is already a Sunday", () => {
    expect(nextSundayOnOrAfter("2026-09-06")).toBe("2026-09-06");
  });

  it("rolls a weekday forward to the coming Sunday", () => {
    expect(nextSundayOnOrAfter("2026-09-07")).toBe("2026-09-13"); // Monday
    expect(nextSundayOnOrAfter("2026-09-12")).toBe("2026-09-13"); // Saturday
  });

  it("crosses month and year boundaries", () => {
    expect(nextSundayOnOrAfter("2026-12-29")).toBe("2027-01-03");
  });

  it("always yields a Sunday", () => {
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
      expect(isSundayDate(nextSundayOnOrAfter(d))).toBe(true);
    }
  });

  it("rejects malformed input", () => {
    expect(() => nextSundayOnOrAfter("not-a-date")).toThrow();
  });
});

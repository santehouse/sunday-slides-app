import { describe, expect, it } from "vitest";
import {
  extractEmailAddress,
  isSenderAllowed,
  normalizeAllowedSender,
  parseAllowedSenders,
} from "@/lib/engines/senderAllowlist";

describe("extractEmailAddress", () => {
  it("strips a display name and lower-cases", () => {
    expect(extractEmailAddress("Pasteur Jean <Jean.Dupont@EAJC.org>")).toBe("jean.dupont@eajc.org");
    expect(extractEmailAddress("  josiah@example.com ")).toBe("josiah@example.com");
  });
});

describe("normalizeAllowedSender", () => {
  it("keeps full addresses and prefixes domains with @", () => {
    expect(normalizeAllowedSender("Pastor@EAJC.org")).toBe("pastor@eajc.org");
    expect(normalizeAllowedSender("eajc.org")).toBe("@eajc.org");
    expect(normalizeAllowedSender("@eajc.org")).toBe("@eajc.org");
  });

  it("rejects things that are neither", () => {
    expect(normalizeAllowedSender("pastor")).toBeNull();
    expect(normalizeAllowedSender("@")).toBeNull();
    expect(normalizeAllowedSender("")).toBeNull();
    expect(normalizeAllowedSender("a@b")).toBeNull();
  });
});

describe("parseAllowedSenders", () => {
  it("splits on newlines, commas and semicolons, de-duplicates, and reports invalid entries", () => {
    const parsed = parseAllowedSenders("pastor@eajc.org\nEAJC.org, secretary@eajc.org; pastor@eajc.org\nnope");
    expect(parsed.entries).toEqual(["pastor@eajc.org", "@eajc.org", "secretary@eajc.org"]);
    expect(parsed.invalid).toEqual(["nope"]);
  });

  it("treats an empty textarea as an empty allowlist", () => {
    expect(parseAllowedSenders("  \n ")).toEqual({ entries: [], invalid: [] });
  });
});

describe("isSenderAllowed", () => {
  it("accepts everyone when the allowlist is empty", () => {
    expect(isSenderAllowed("anyone@spam.example", [])).toBe(true);
  });

  it("matches full addresses case-insensitively, including behind a display name", () => {
    const list = ["pastor@eajc.org"];
    expect(isSenderAllowed("Pastor <PASTOR@eajc.org>", list)).toBe(true);
    expect(isSenderAllowed("someone@eajc.org", list)).toBe(false);
  });

  it("matches a whole domain, but not a look-alike domain", () => {
    const list = ["@eajc.org"];
    expect(isSenderAllowed("anyone@eajc.org", list)).toBe(true);
    expect(isSenderAllowed("anyone@eajc.org.evil.example", list)).toBe(false);
    expect(isSenderAllowed("anyone@sub.eajc.org", list)).toBe(false);
  });

  it("rejects a sender with no usable address", () => {
    expect(isSenderAllowed("mystery", ["@eajc.org"])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { resolveSlideBackgroundHex } from "./background";

const colors = { navy: "#0f172a", yellow: "#facc15" };

describe("resolveSlideBackgroundHex", () => {
  it("locked colour templates always paint their own colour, even with a stale approved colour", () => {
    const template = { backgroundType: "color" as const, backgroundValue: "#facc15", allowTeamBackgroundChoice: false };
    expect(resolveSlideBackgroundHex(template, { approvedColorId: "navy" }, colors)).toBe("#facc15");
  });

  it("team-choice templates use the approved colour and fall back to the template colour", () => {
    const template = { backgroundType: "color" as const, backgroundValue: "#facc15", allowTeamBackgroundChoice: true };
    expect(resolveSlideBackgroundHex(template, { approvedColorId: "navy" }, colors)).toBe("#0f172a");
    expect(resolveSlideBackgroundHex(template, { approvedColorId: "missing" }, colors)).toBe("#facc15");
    expect(resolveSlideBackgroundHex(template, { approvedColorId: null }, colors)).toBe("#facc15");
  });

  it("image templates only get a colour when the team may switch to one", () => {
    const open = { backgroundType: "image" as const, backgroundValue: "asset-1", allowTeamBackgroundChoice: true };
    expect(resolveSlideBackgroundHex(open, { approvedColorId: "navy" }, colors)).toBe("#0f172a");
    expect(resolveSlideBackgroundHex(open, { approvedColorId: null }, colors)).toBeNull();
    const locked = { ...open, allowTeamBackgroundChoice: false };
    expect(resolveSlideBackgroundHex(locked, { approvedColorId: "navy" }, colors)).toBeNull();
  });

  it("accepts a lookup function", () => {
    const template = { backgroundType: "color" as const, backgroundValue: "#facc15", allowTeamBackgroundChoice: true };
    expect(resolveSlideBackgroundHex(template, { approvedColorId: "navy" }, (id) => colors[id as keyof typeof colors])).toBe("#0f172a");
  });
});

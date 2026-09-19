import { describe, expect, it } from "vitest";
import { boxGradientCss, moveGradientStop, normalizeBoxGradient } from "@/lib/engines/boxGradient";

describe("normalizeBoxGradient", () => {
  it("keeps 2–7 hex stops, lower-cased, and wraps the angle", () => {
    expect(normalizeBoxGradient({ angle: -90, stops: ["#F6D3AE", "#e9b98a"] })).toEqual({ angle: 270, stops: ["#f6d3ae", "#e9b98a"] });
    expect(normalizeBoxGradient({ angle: 180, stops: ["#1", "#f6d3ae", "#e9b98a", "#f3d58f"] })).toEqual({
      angle: 180,
      stops: ["#f6d3ae", "#e9b98a", "#f3d58f"],
    });
    const eight = Array.from({ length: 8 }, (_, i) => `#00000${i}`);
    expect(normalizeBoxGradient({ angle: 0, stops: eight })?.stops).toHaveLength(7);
  });

  it("rejects anything that is not a usable gradient", () => {
    expect(normalizeBoxGradient(null)).toBeNull();
    expect(normalizeBoxGradient("linear-gradient(red, blue)")).toBeNull();
    expect(normalizeBoxGradient({ angle: 90, stops: ["#ffffff"] })).toBeNull();
    expect(normalizeBoxGradient({ stops: ["red", "blue"] })).toBeNull();
  });

  it("defaults a missing angle to top-to-bottom", () => {
    expect(normalizeBoxGradient({ stops: ["#000000", "#ffffff"] })?.angle).toBe(180);
  });
});

describe("boxGradientCss / moveGradientStop", () => {
  it("emits one CSS linear-gradient", () => {
    expect(boxGradientCss({ angle: 180, stops: ["#f6d3ae", "#e9b98a"] })).toBe("linear-gradient(180deg, #f6d3ae, #e9b98a)");
  });

  it("reorders stops and ignores impossible moves", () => {
    expect(moveGradientStop(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveGradientStop(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveGradientStop(["a", "b"], 1, 5)).toEqual(["a", "b"]);
  });
});

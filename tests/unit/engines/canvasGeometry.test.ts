import { describe, expect, it } from "vitest";
import {
  applyHandleDrag,
  buildGuides,
  clampBox,
  intersects,
  moveBox,
  snap,
  snapEdge,
} from "@/lib/engines/canvasGeometry";

describe("snap", () => {
  it("snaps to a guide within the threshold", () => {
    expect(snap(100, [96], 12)).toBe(96);
    expect(snap(104, [96], 12)).toBe(96);
  });

  it("falls back to the 8px grid when no guide is close enough", () => {
    expect(snap(101, [], 12, 8)).toBe(104);
    expect(snap(45, [], 12, 8)).toBe(48);
  });

  it("prefers the nearest guide when several are provided", () => {
    expect(snap(50, [0, 48, 200], 12)).toBe(48);
  });
});

describe("snapEdge", () => {
  it("reports the guide it snapped to", () => {
    expect(snapEdge(1918, [1920], 12)).toEqual({ value: 1920, guide: 1920 });
  });

  it("reports no guide when nothing is within range", () => {
    expect(snapEdge(500, [1920], 12)).toEqual({ value: 500, guide: null });
  });
});

describe("buildGuides", () => {
  it("always includes the canvas edges and 96px margins", () => {
    const { x, y } = buildGuides();
    expect(x).toEqual([0, 1920, 96, 1824]);
    expect(y).toEqual([0, 1080, 96, 984]);
  });

  it("adds the safe zone's edges when given one", () => {
    const { x, y } = buildGuides({ x: 40, y: 700, width: 500, height: 300 });
    expect(x).toContain(40);
    expect(x).toContain(540);
    expect(y).toContain(700);
    expect(y).toContain(1000);
  });
});

describe("clampBox", () => {
  it("leaves a box that already fits untouched", () => {
    expect(clampBox({ x: 100, y: 100, width: 400, height: 200 })).toEqual({ x: 100, y: 100, width: 400, height: 200 });
  });

  it("enforces the minimum size", () => {
    expect(clampBox({ x: 100, y: 100, width: 10, height: 5 })).toEqual({ x: 100, y: 100, width: 80, height: 40 });
  });

  it("pulls a box back inside the canvas on the right/bottom edges", () => {
    expect(clampBox({ x: 1900, y: 1060, width: 200, height: 100 })).toEqual({ x: 1720, y: 980, width: 200, height: 100 });
  });

  it("clamps negative origins to 0", () => {
    expect(clampBox({ x: -50, y: -20, width: 200, height: 100 })).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it("caps a box larger than the canvas to the canvas size", () => {
    expect(clampBox({ x: 0, y: 0, width: 5000, height: 5000 })).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
});

describe("intersects", () => {
  const zone = { x: 0, y: 700, width: 600, height: 380 };

  it("detects overlap", () => {
    expect(intersects({ x: 300, y: 900, width: 200, height: 100 }, zone)).toBe(true);
  });

  it("detects no overlap when boxes are apart", () => {
    expect(intersects({ x: 1000, y: 0, width: 200, height: 100 }, zone)).toBe(false);
  });

  it("treats touching edges as not overlapping", () => {
    expect(intersects({ x: 600, y: 700, width: 200, height: 100 }, zone)).toBe(false);
  });
});

describe("moveBox", () => {
  it("adds the delta to x/y and leaves width/height alone", () => {
    expect(moveBox({ x: 10, y: 20, width: 100, height: 50 }, 5, -5)).toEqual({ x: 15, y: 15, width: 100, height: 50 });
  });
});

describe("applyHandleDrag", () => {
  const box = { x: 100, y: 100, width: 300, height: 200 };

  it("edge handle 'e' grows width only", () => {
    expect(applyHandleDrag(box, "e", 50, 999)).toEqual({ x: 100, y: 100, width: 350, height: 200 });
  });

  it("edge handle 'w' moves x and shrinks width", () => {
    expect(applyHandleDrag(box, "w", 20, 999)).toEqual({ x: 120, y: 100, width: 280, height: 200 });
  });

  it("edge handle 's' grows height only", () => {
    expect(applyHandleDrag(box, "s", 999, 30)).toEqual({ x: 100, y: 100, width: 300, height: 230 });
  });

  it("edge handle 'n' moves y and shrinks height", () => {
    expect(applyHandleDrag(box, "n", 999, 40)).toEqual({ x: 100, y: 140, width: 300, height: 160 });
  });

  it("corner handle 'se' changes width and height together", () => {
    expect(applyHandleDrag(box, "se", 10, 20)).toEqual({ x: 100, y: 100, width: 310, height: 220 });
  });

  it("corner handle 'nw' moves both origin and shrinks both dimensions", () => {
    expect(applyHandleDrag(box, "nw", 10, 20)).toEqual({ x: 110, y: 120, width: 290, height: 180 });
  });

  it("never shrinks width below the minimum, pinning the fixed edge", () => {
    const result = applyHandleDrag(box, "e", -290, 0, { width: 80, height: 40 });
    expect(result.width).toBe(80);
    expect(result.x).toBe(100); // fixed (left) edge unchanged
  });

  it("never shrinks width below the minimum when dragging the moving edge ('w')", () => {
    const result = applyHandleDrag(box, "w", 290, 0, { width: 80, height: 40 });
    expect(result.width).toBe(80);
    expect(result.x + result.width).toBe(box.x + box.width); // right edge stays fixed
  });

  it("never shrinks height below the minimum", () => {
    const result = applyHandleDrag(box, "s", 0, -190, { width: 80, height: 40 });
    expect(result.height).toBe(40);
    expect(result.y).toBe(100);
  });
});

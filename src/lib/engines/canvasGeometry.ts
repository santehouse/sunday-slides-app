/**
 * Pure math for the Template Studio interactive canvas (BUILD_HANDOFF §12/13).
 * Everything here operates in slide-space integers (1920×1080) — no DOM, no React.
 * `StudioCanvas` converts pointer/keyboard deltas into slide-space and calls into
 * this module; it never reimplements the snapping/clamping/overlap math itself.
 */
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@/lib/renderer/types";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const GRID = 8;
export const MIN_WIDTH = 80;
export const MIN_HEIGHT = 40;
export const SNAP_THRESHOLD = 12;
/** The 96px broadcast-safe margin guide shown while dragging (BUILD_HANDOFF §13). */
export const MARGIN = 96;

/** Snaps one edge value to the nearest guide within `threshold`; falls back to the 8px grid. */
export function snap(value: number, guides: number[] = [], threshold: number = SNAP_THRESHOLD, grid: number = GRID): number {
  const hit = snapEdge(value, guides, threshold);
  if (hit.guide !== null) return hit.value;
  return Math.round(value / grid) * grid;
}

/** Like `snap`, but also reports which guide (if any) was hit — used to draw the snap line. */
export function snapEdge(
  value: number,
  guides: number[] = [],
  threshold: number = SNAP_THRESHOLD,
): { value: number; guide: number | null } {
  let best: number | null = null;
  let bestDist = threshold;
  for (const guide of guides) {
    const dist = Math.abs(value - guide);
    if (dist <= bestDist) {
      best = guide;
      bestDist = dist;
    }
  }
  return best === null ? { value, guide: null } : { value: best, guide: best };
}

/** Canvas edges + 96px margin lines + (optionally) the safe zone's edges, as snap guides. */
export function buildGuides(safeZone?: Box, margin: number = MARGIN): { x: number[]; y: number[] } {
  const x = [0, SLIDE_WIDTH, margin, SLIDE_WIDTH - margin];
  const y = [0, SLIDE_HEIGHT, margin, SLIDE_HEIGHT - margin];
  if (safeZone) {
    x.push(safeZone.x, safeZone.x + safeZone.width);
    y.push(safeZone.y, safeZone.y + safeZone.height);
  }
  return { x, y };
}

/** Clamps a box to a minimum size and fully inside the given canvas (defaults: 1920×1080). */
export function clampBox(
  box: Box,
  canvas: { width: number; height: number } = { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
  min: { width: number; height: number } = { width: MIN_WIDTH, height: MIN_HEIGHT },
): Box {
  const width = Math.min(Math.max(box.width, min.width), canvas.width);
  const height = Math.min(Math.max(box.height, min.height), canvas.height);
  const x = Math.min(Math.max(box.x, 0), canvas.width - width);
  const y = Math.min(Math.max(box.y, 0), canvas.height - height);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/** True when two boxes (in the same coordinate space) overlap at all. */
export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Applies a resize-handle drag: edge handles change one dimension, corner handles two.
 * The edge(s) opposite the dragged handle stay fixed. Enforces `min` size by pulling the
 * moving edge back in (never past the fixed edge) rather than growing the other way.
 */
export function applyHandleDrag(
  box: Box,
  handle: Handle,
  dx: number,
  dy: number,
  min: { width: number; height: number } = { width: MIN_WIDTH, height: MIN_HEIGHT },
): Box {
  let { x, y, width, height } = box;
  const hasN = handle.includes("n");
  const hasS = handle.includes("s");
  const hasE = handle.includes("e");
  const hasW = handle.includes("w");

  if (hasE) width += dx;
  if (hasW) {
    x += dx;
    width -= dx;
  }
  if (hasS) height += dy;
  if (hasN) {
    y += dy;
    height -= dy;
  }

  if (width < min.width) {
    if (hasW) x -= min.width - width;
    width = min.width;
  }
  if (height < min.height) {
    if (hasN) y -= min.height - height;
    height = min.height;
  }

  return { x, y, width, height };
}

/** Moves a box by a slide-space delta — trivial, but keeps every drag-math call in one module. */
export function moveBox(box: Box, dx: number, dy: number): Box {
  return { ...box, x: box.x + dx, y: box.y + dy };
}

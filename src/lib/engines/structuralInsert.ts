/**
 * Default structural slide insertion + Sunday Flow ordering (section 19 of
 * BUILD_HANDOFF.md). Pure, no I/O.
 */

import type { DefaultStructuralSlide, Slide, StructuralSortZone } from "@/lib/domain/types";

export interface StructuralInsertPlan {
  default: DefaultStructuralSlide;
  zone: StructuralSortZone;
}

export interface StructuralPlanResult {
  toInsert: StructuralInsertPlan[];
  /** ids of DefaultStructuralSlide records that were NOT inserted, and why doesn't matter to the caller. */
  skipped: string[];
}

/**
 * Decides which enabled default structural slides are missing from the
 * current deck and should be auto-inserted.
 *
 * - `manual` rule slides are never auto-inserted (Add Slide only).
 * - `always`/`default` rule slides are inserted unless a slide already
 *   exists referencing that default (`structuralDefaultId`).
 * - Disabled defaults are skipped entirely.
 */
export function planStructuralSlides(
  defaults: DefaultStructuralSlide[],
  existing: Slide[],
): StructuralPlanResult {
  const existingDefaultIds = new Set(
    existing
      .filter((slide) => slide.structuralDefaultId !== null)
      .map((slide) => slide.structuralDefaultId as string),
  );

  const toInsert: StructuralInsertPlan[] = [];
  const skipped: string[] = [];

  for (const def of defaults) {
    if (!def.enabled) {
      skipped.push(def.id);
      continue;
    }
    if (def.insertionRule === "manual") {
      skipped.push(def.id);
      continue;
    }
    if (existingDefaultIds.has(def.id)) {
      skipped.push(def.id);
      continue;
    }
    toInsert.push({ default: def, zone: def.defaultSortZone });
  }

  return { toInsert, skipped };
}

const ZONE_ORDER: StructuralSortZone[] = ["opening", "before_announcements", "after_announcements", "closing"];

/**
 * Interleaves structural slides (grouped by zone, sorted by `sortOrder`
 * within a zone) around the announcement slides, in the fixed zone order:
 * opening → before_announcements → announcements → after_announcements → closing.
 */
export function orderSlides<A, S extends { zone: StructuralSortZone; sortOrder: number }>(
  announcementSlides: A[],
  structuralSlides: S[],
): (A | S)[] {
  const byZone = (zone: StructuralSortZone): S[] =>
    structuralSlides.filter((slide) => slide.zone === zone).sort((a, b) => a.sortOrder - b.sortOrder);

  const [opening, beforeAnnouncements, afterAnnouncements, closing] = ZONE_ORDER.map(byZone);

  return [...opening, ...beforeAnnouncements, ...announcementSlides, ...afterAnnouncements, ...closing];
}

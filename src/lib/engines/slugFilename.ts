/**
 * Export filename helpers (section 9 of BUILD_HANDOFF.md): `01-[headline-title].jpg`.
 * Pure, no I/O.
 */

const MAX_SLUG_LENGTH = 60;

/**
 * Lowercases, strips accents, and collapses anything that isn't `[a-z0-9]`
 * into single dashes. Falls back to `"slide"` when nothing usable remains.
 */
export function slugifyHeadline(text: string): string {
  const withoutAccents = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const slug = withoutAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || "slide";
}

/**
 * Builds export filenames in current Sunday Flow order:
 * `01-rendez-vous-de-la-semaine.jpg`. Zero-pads the prefix to 2 digits
 * (3 once there are 100+ slides) and gives repeated slugs a stable
 * `-2`, `-3`, ... suffix in encounter order.
 */
export function buildExportFilenames(slides: { headline: string }[]): string[] {
  const padWidth = slides.length >= 100 ? 3 : 2;
  const seenCounts = new Map<string, number>();

  return slides.map((slide, index) => {
    const baseSlug = slugifyHeadline(slide.headline);
    const occurrence = (seenCounts.get(baseSlug) ?? 0) + 1;
    seenCounts.set(baseSlug, occurrence);

    const slug = occurrence === 1 ? baseSlug : `${baseSlug}-${occurrence}`;
    const prefix = String(index + 1).padStart(padWidth, "0");
    return `${prefix}-${slug}.jpg`;
  });
}

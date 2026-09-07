import type { Slide, Template } from "@/lib/domain/types";

/**
 * The one rule for a slide's colour background, shared by every preview (queue thumbnails,
 * the preview card, the Edit modal, the Export picker) and the server renderer:
 *
 * - A template that does NOT let the Sunday team pick a background always paints its own
 *   colour (`backgroundValue`) — a stale `approvedColorId` on the slide is ignored. This is
 *   what kept "Giving" (navy text on a yellow template) rendering navy-on-navy: the slide
 *   was created with the first approved colour, which happened to match the text colour.
 * - Otherwise the team's approved colour wins, falling back to the template colour.
 */
export function resolveSlideBackgroundHex(
  template: Pick<Template, "backgroundType" | "backgroundValue" | "allowTeamBackgroundChoice">,
  slide: Pick<Slide, "approvedColorId">,
  colorHexById: Record<string, string> | ((id: string) => string | null | undefined),
): string | null {
  const templateHex = template.backgroundType === "color" ? template.backgroundValue : null;
  if (!template.allowTeamBackgroundChoice) return templateHex;
  const lookup = typeof colorHexById === "function" ? colorHexById : (id: string) => colorHexById[id];
  const approvedHex = slide.approvedColorId ? (lookup(slide.approvedColorId) ?? null) : null;
  return approvedHex ?? templateHex;
}

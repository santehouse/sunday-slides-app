import type { Slide, Template } from "@/lib/domain/types";
import { effectiveFieldText } from "./fitText";

/** Storage keys of image-field pictures live under this prefix (see `keys.slideImages`). */
export const SLIDE_IMAGE_PREFIX = "slide-images/";

/** True for a storage key the `/api/images` proxy is allowed to serve. */
export function isSlideImageKey(key: string): boolean {
  return /^slide-images\/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(key);
}

/** Browser URL for a stored slide picture — the session-gated proxy route. */
export function slideImageBrowserUrl(key: string): string {
  return `/api/images/${key}`;
}

/**
 * Picture URLs for every image field of `template` that `slide` has filled, for browser
 * previews (thumbnails, the preview card, the Edit modal). The server renderer builds
 * the same map with inlined data URIs instead — see `lib/sunday/render-input.ts`.
 */
export function browserImageUrls(
  template: Pick<Template, "fields">,
  slide: Pick<Slide, "headline" | "content">,
): Record<string, string> {
  const content = { headline: slide.headline, ...slide.content };
  const urls: Record<string, string> = {};
  for (const field of template.fields) {
    if (field.fieldType !== "image") continue;
    const key = effectiveFieldText(field, content);
    if (key && isSlideImageKey(key)) urls[key] = slideImageBrowserUrl(key);
  }
  return urls;
}

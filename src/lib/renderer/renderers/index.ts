/**
 * Renderer registry. A "renderer" turns a `RenderSlideInput` + its precomputed
 * `SlideLayoutMap` into the slide's visual layers (background, overlay, text) — it does
 * NOT own the outer 1920×1080 frame or the safe-zone guide, both handled once by
 * `SlideCanvas` regardless of which renderer draws the body.
 *
 * `Template.rendererKey` selects the entry. Unknown/missing keys fall back to
 * "generic-v1" so a template never fails to render because of a typo or a renderer that
 * hasn't shipped yet.
 *
 * See docs/RENDERING.md for how to register a bespoke renderer.
 */
import type { ReactNode } from "react";
import type { RenderSlideInput, SlideLayoutMap } from "../types";
import { GenericRenderer } from "./generic";

export type SlideRenderer = (input: RenderSlideInput, layouts: SlideLayoutMap) => ReactNode;

export const renderers: Record<string, SlideRenderer> = {
  "generic-v1": GenericRenderer,
};

export function getRenderer(rendererKey: string): SlideRenderer {
  return renderers[rendererKey] ?? renderers["generic-v1"];
}
